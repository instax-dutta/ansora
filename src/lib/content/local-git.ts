/**
 * LocalGitAdapter — used when DEPLOYMENT_MODE=self-hosted.
 *
 * Reads/writes markdown files directly on local disk, then commits every
 * change with git (and optionally pushes, when GIT_AUTO_PUSH=true).
 *
 * The content directory can be:
 *  - inside the app repo  (CONTENT_REPO_MODE=same-repo, the default) — the
 *    existing repository is used for commits;
 *  - its own git repo     (CONTENT_REPO_MODE=external-repo, or a Docker volume
 *    that starts empty)   — we lazily `git init` it on first write.
 */
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import simpleGit, { type SimpleGit } from "simple-git";
import type { ContentAdapter } from "./index";
import type { Post, PostMeta, SiteConfig } from "./types";
import {
  DEFAULT_SITE_CONFIG,
  normalizeFrontmatter,
  siteConfigSchema,
} from "./types";

export class LocalGitAdapter implements ContentAdapter {
  readonly mode = "self-hosted" as const;

  private readonly postsDir: string;
  private readonly configPath: string;
  private gitPromise: Promise<SimpleGit> | null = null;

  constructor(private readonly contentDir: string) {
    this.postsDir = path.join(contentDir, "posts");
    this.configPath = path.join(contentDir, "site.config.json");
  }

  /** Lazy git handle — inits the content dir as a repo if it isn't one. */
  private getGit(): Promise<SimpleGit> {
    if (!this.gitPromise) {
      this.gitPromise = this.initGit();
    }
    return this.gitPromise;
  }

  private async initGit(): Promise<SimpleGit> {
    await fs.mkdir(this.postsDir, { recursive: true });
    const git = simpleGit({ baseDir: this.contentDir });
    const isRepo = await git
      .revparse(["--is-inside-work-tree"])
      .then(() => true)
      .catch(() => false);

    if (!isRepo) {
      await git.init();
    }

    // Set a local identity only if the repo has none (never clobber the
    // author's real git config).
    const name = await git.getConfig("user.name").then((c) => c.value).catch(() => null);
    const email = await git.getConfig("user.email").then((c) => c.value).catch(() => null);
    if (!name) await git.addConfig("user.name", process.env.GIT_USER_NAME || "Ansora");
    if (!email) await git.addConfig("user.email", process.env.GIT_USER_EMAIL || "ansora@localhost");

    return git;
  }

  private async commit(files: string[], message: string): Promise<void> {
    const git = await this.getGit();
    const relative = files.map((f) => path.relative(this.contentDir, f));
    await git.add(relative);
    try {
      await git.commit(message);
    } catch (err) {
      // A no-op save (identical content) has nothing to commit — that's fine.
      const text = String(err);
      if (text.includes("nothing to commit") || text.includes("no changes added")) {
        return;
      }
      throw err;
    }
    if (process.env.GIT_AUTO_PUSH === "true") {
      await git.push();
    }
  }

  /* ------------------------------ Reads ---------------------------------- */

  async listPosts(): Promise<PostMeta[]> {
    const entries = await fs.readdir(this.postsDir).catch(() => []);
    const posts: PostMeta[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      try {
        const raw = await fs.readFile(path.join(this.postsDir, entry), "utf8");
        const { data } = matter(raw);
        posts.push(normalizeFrontmatter(data as Record<string, unknown>));
      } catch {
        // Skip unreadable/corrupt files rather than breaking the whole blog.
        continue;
      }
    }

    return posts.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getPost(slug: string): Promise<Post | null> {
    const fileName = `${slug}.md`;
    const raw = await fs
      .readFile(path.join(this.postsDir, fileName), "utf8")
      .catch(() => null);
    if (raw === null) return null;

    const { data, content } = matter(raw);
    const meta = normalizeFrontmatter(data as Record<string, unknown>);
    // The file name is the source of truth for the URL slug.
    return { meta: { ...meta, slug }, content, fileName };
  }

  /* ------------------------------ Writes --------------------------------- */

  async savePost(slug: string, content: string, frontmatter: object): Promise<void> {
    const meta = normalizeFrontmatter(frontmatter as Record<string, unknown>);
    const file = path.join(this.postsDir, `${slug}.md`);
    const serialized = matter.stringify(content, {
      ...meta,
      slug, // never trust a caller-supplied slug to match the file name
    });

    await fs.mkdir(this.postsDir, { recursive: true });
    await fs.writeFile(file, serialized, "utf8");
    await this.commit([file], `Post: ${slug}`);
  }

  async deletePost(slug: string): Promise<void> {
    const file = path.join(this.postsDir, `${slug}.md`);
    const exists = await fs.access(file).then(() => true).catch(() => false);
    if (!exists) return; // nothing to delete — mirror the GitHub adapter
    await fs.rm(file, { force: true });
    await this.commit([file], `Delete: ${slug}`);
  }

  /* --------------------------- Site config -------------------------------- */

  async getSiteConfig(): Promise<SiteConfig> {
    const raw = await fs.readFile(this.configPath, "utf8").catch(() => null);
    if (raw === null) {
      // First run — seed defaults on disk WITHOUT a commit (a read-only page
      // view shouldn't create git history). The admin's first edit commits.
      await fs.mkdir(this.contentDir, { recursive: true });
      await fs.writeFile(
        this.configPath,
        `${JSON.stringify(DEFAULT_SITE_CONFIG, null, 2)}\n`,
        "utf8"
      );
      return DEFAULT_SITE_CONFIG;
    }
    try {
      return siteConfigSchema.parse(JSON.parse(raw));
    } catch {
      return DEFAULT_SITE_CONFIG;
    }
  }

  async saveSiteConfig(config: SiteConfig): Promise<void> {
    await fs.writeFile(
      this.configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8"
    );
    await this.commit([this.configPath], "Update site config");
  }
}
