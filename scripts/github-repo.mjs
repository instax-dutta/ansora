#!/usr/bin/env node
/**
 * GitHub content-repo helper used by scripts/verify-serverless.sh.
 *
 * Requires GITHUB_REPO and GITHUB_TOKEN (run with `node --env-file=.env.local`).
 *
 * Commands:
 *   ls [dir]                List files under a repo path (recursive tree).
 *   get <path>              Print raw file content, or "<absent>" if missing.
 *   snapshot <out.json>     Capture every file's content + site config for later
 *                           restore. Safe to run against a repo with existing
 *                           content — it's a full picture, not a diff.
 *   restore <snapshot.json> Bring the repo back to the snapshot state: recreate
 *                           missing files, delete files added since, restore the
 *                           site config (or delete it if it didn't exist).
 *   commits <path> [n]      Print the most recent n commit messages touching a
 *                           path (default 10) — proves writes landed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { Octokit } from "octokit";

const repo = process.env.GITHUB_REPO ?? "";
const token = process.env.GITHUB_TOKEN ?? "";
const branch = process.env.GITHUB_BRANCH || "main";

if (!repo || !token) {
  console.error(
    "github-repo.mjs requires GITHUB_REPO and GITHUB_TOKEN. Run with:\n" +
      "  node --env-file=.env.local scripts/github-repo.mjs <command>"
  );
  process.exit(1);
}

const [owner, name] = repo.split("/");
if (!owner || !name) {
  console.error(`GITHUB_REPO must be "owner/repo", got "${repo}"`);
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

async function getTree() {
  try {
    const res = await octokit.rest.git.getTree({
      owner,
      repo: name,
      tree_sha: branch,
      recursive: "true",
    });
    return res.data.tree ?? [];
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

async function getContent(path) {
  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path,
      ref: branch,
    });
    if (Array.isArray(res.data) || !res.data.content) return null;
    return Buffer.from(res.data.content, "base64").toString("utf8");
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

async function putContent(path, content, message) {
  let sha = null;
  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path,
      ref: branch,
    });
    if (!Array.isArray(res.data)) sha = res.data.sha;
  } catch {
    /* new file */
  }
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: name,
    path,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  });
}

async function deleteContent(path, message) {
  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path,
      ref: branch,
    });
    if (Array.isArray(res.data)) {
      for (const entry of res.data) {
        if (entry.type === "file") {
          await octokit.rest.repos.deleteFile({
            owner,
            repo: name,
            path: entry.path,
            message,
            sha: entry.sha,
            branch,
          });
        }
      }
      return;
    }
    await octokit.rest.repos.deleteFile({
      owner,
      repo: name,
      path,
      message,
      sha: res.data.sha,
      branch,
    });
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
}

/* ------------------------------- Commands -------------------------------- */

async function cmdLs(dir = "") {
  const prefix = dir ? `${dir.replace(/\/$/, "")}/` : "";
  const tree = await getTree();
  const files = tree
    .filter((t) => t.type === "blob" && (!dir || t.path?.startsWith(prefix)))
    .map((t) => t.path)
    .sort();
  for (const f of files) console.log(f);
}

async function cmdGet(path) {
  const content = await getContent(path);
  console.log(content ?? "<absent>");
}

async function cmdSnapshot(outFile) {
  const tree = await getTree();
  const files = tree.filter((t) => t.type === "blob").map((t) => t.path);
  const contents = {};
  for (const f of files) {
    // Skip files that vanished between the tree listing and the content
    // fetch (a tiny race) — they're gone from the repo, so restore must not
    // resurrect them or write a literal "null".
    const content = await getContent(f);
    if (content !== null) contents[f] = content;
  }
  const snapshot = {
    repo,
    branch,
    files: contents,
  };
  await writeFile(outFile, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Snapshot written to ${outFile}: ${files.length} file(s), ` +
      `branch "${branch}".`
  );
}

async function cmdRestore(snapshotFile) {
  const snapshot = JSON.parse(await readFile(snapshotFile, "utf8"));
  if (snapshot.repo !== repo || snapshot.branch !== branch) {
    console.error(
      `Snapshot is for ${snapshot.repo}#${snapshot.branch}, but this run is ` +
        `${repo}#${branch} — refusing to restore.`
    );
    process.exit(1);
  }

  const current = new Set(
    (await getTree()).filter((t) => t.type === "blob").map((t) => t.path)
  );
  const wanted = new Set(Object.keys(snapshot.files));

  // Delete files that appeared since the snapshot (i.e. created by the test).
  for (const path of [...current].sort()) {
    if (!wanted.has(path)) {
      console.log(`  delete ${path}`);
      await deleteContent(path, "Test cleanup: remove scratch file");
    }
  }
  // Recreate files that vanished since the snapshot (shouldn't happen here,
  // but makes restore a true round-trip).
  for (const path of [...wanted].sort()) {
    if (!current.has(path)) {
      console.log(`  recreate ${path}`);
      await putContent(path, snapshot.files[path], "Test cleanup: restore file");
    }
  }
  // Site config may have changed in place — restore its exact content.
  const configPath = process.env.GITHUB_SITE_CONFIG_PATH || "content/site.config.json";
  const original = snapshot.files[configPath] ?? null;
  const now = await getContent(configPath);
  if (original === null && now !== null) {
    console.log(`  delete ${configPath} (did not exist before the test)`);
    await deleteContent(configPath, "Test cleanup: remove site config");
  } else if (original !== null && original !== now) {
    console.log(`  restore ${configPath}`);
    await putContent(configPath, original, "Test cleanup: restore site config");
  }

  console.log("Restore complete — repo is back to its snapshot state.");
}

async function cmdCommits(path, count = 10) {
  const res = await octokit.rest.repos.listCommits({
    owner,
    repo: name,
    path,
    per_page: Math.min(count, 100),
    sha: branch,
  });
  for (const c of res.data) {
    console.log(`${c.sha.slice(0, 7)}  ${c.commit.message.split("\n")[0]}`);
  }
}

/* --------------------------------- Main ---------------------------------- */

const [command, arg1, arg2] = process.argv.slice(2);

try {
  switch (command) {
    case "ls":
      await cmdLs(arg1);
      break;
    case "get":
      if (!arg1) throw new Error("usage: github-repo.mjs get <path>");
      await cmdGet(arg1);
      break;
    case "snapshot":
      if (!arg1) throw new Error("usage: github-repo.mjs snapshot <out.json>");
      await cmdSnapshot(arg1);
      break;
    case "restore":
      if (!arg1) throw new Error("usage: github-repo.mjs restore <snapshot.json>");
      await cmdRestore(arg1);
      break;
    case "commits":
      if (!arg1) throw new Error("usage: github-repo.mjs commits <path> [n]");
      await cmdCommits(arg1, Number(arg2) || 10);
      break;
    default:
      console.error(
        "Unknown command. Use: ls | get | snapshot | restore | commits"
      );
      process.exit(1);
  }
} catch (err) {
  console.error("github-repo.mjs failed:", err?.message ?? err);
  process.exit(1);
}
