/**
 * GitHubApiAdapter — used when DEPLOYMENT_MODE=serverless (Vercel/Netlify).
 *
 * Reads/writes posts through the GitHub REST API (octokit) against a content
 * repo. Every save is a commit via the Contents API. Reads hit the API
 * directly (with a short TTL cache) so the admin dashboard reflects reality
 * immediately, even before the public site rebuilds.
 *
 * Note on the SHA dance: updating a file through the Contents API requires the
 * current file SHA, so we fetch it before every update.
 */
import matter from "gray-matter";
import { Octokit } from "octokit";
import { TtlCache } from "./cache";
import { mapWithConcurrency } from "./concurrency";
import type { ContentAdapter } from "./index";
import { isSafeSlug } from "./slug";
import type { Post, PostMeta, SiteConfig } from "./types";
import {
  DEFAULT_SITE_CONFIG,
  normalizeFrontmatter,
  siteConfigSchema,
} from "./types";

interface GitHubAdapterOptions {
  /** "owner/repo" */
  repo: string;
  token: string;
  branch: string;
  /** Repo path to the posts folder, e.g. "content/posts" */
  postsPath: string;
  /** Repo path to site.config.json */
  configPath: string;
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { status?: unknown }).status === 404
  );
}

/** Rate limited, forbidden, or a server-side hiccup: worth one retry. */
function isTransient(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const status = (err as { status?: unknown }).status;
  if (typeof status !== "number") return false;
  return status === 403 || status === 429 || status >= 500;
}

const RETRY_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GitHubApiAdapter implements ContentAdapter {
  readonly mode = "serverless" as const;

  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;

  // Short TTLs keep repeated renders cheap while staying fresh for editing.
  private readonly listCache = new TtlCache<PostMeta[]>(60_000);
  private readonly postCache = new TtlCache<Post | null>(60_000);
  private readonly configCache = new TtlCache<SiteConfig>(60_000);

  constructor(private readonly options: GitHubAdapterOptions) {
    const [owner, repo] = options.repo.split("/");
    if (!owner || !repo) {
      throw new Error(`GITHUB_REPO must be "owner/repo", got "${options.repo}"`);
    }
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({ auth: options.token });
  }

  private filePath(slug: string): string {
    return `${this.options.postsPath}/${slug}.md`;
  }

  /**
   * Read a file, retrying once on a *transient* failure.
   *
   * 404 is not an error at all — it means the file is absent, which the
   * original in-place `catch` translated to `null`. That translation must be
   * preserved on both the first attempt and the retry, or a missing file throws
   * and takes down a listing.
   *
   * 403/429/5xx *are* transient: one short-backoff retry usually clears a rate
   * limit or a blip, and the caller never learns anything went wrong. One retry,
   * not a loop — genuine quota exhaustion will still fail, and hammering a
   * rate-limited API makes it worse.
   */
  private async getFileRaw(filePath: string): Promise<{ content: string; sha: string } | null> {
    try {
      return await this.fetchFileRaw(filePath);
    } catch (err) {
      if (isNotFound(err)) return null;
      if (!isTransient(err)) throw err;
      await sleep(RETRY_BACKOFF_MS);
      try {
        return await this.fetchFileRaw(filePath);
      } catch (retryErr) {
        if (isNotFound(retryErr)) return null;
        throw retryErr;
      }
    }
  }

  private async fetchFileRaw(filePath: string): Promise<{ content: string; sha: string } | null> {
    const res = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path: filePath,
      ref: this.options.branch,
    });
    const data = res.data as { content?: string; sha?: string };
    if (Array.isArray(res.data) || !data.content || !data.sha) return null;
    return {
      content: Buffer.from(data.content, "base64").toString("utf8"),
      sha: data.sha,
    };
  }

  private async getFileSha(filePath: string): Promise<string | null> {
    const file = await this.getFileRaw(filePath);
    return file?.sha ?? null;
  }

  /* ------------------------------ Reads ---------------------------------- */

  private async fetchTreeWithRetry() {
    try {
      return await this.fetchTree();
    } catch (err) {
      if (isNotFound(err) || !isTransient(err)) throw err;
      await sleep(RETRY_BACKOFF_MS);
      return this.fetchTree();
    }
  }
  private fetchTree() {
    return this.octokit.rest.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: this.options.branch,
      recursive: "true",
    });
  }

  async listPosts(): Promise<PostMeta[]> {
    // Always re-check the tree metadata so a new content commit is visible
    // immediately, even when the request lands on a warm serverless instance.
    // The tree SHA changes whenever a file in the repository tree changes, so
    // unchanged content still benefits from the short-lived parsed-list cache.
    // The tree call is the single point of failure for the whole site: if it
    // throws, `safeListPosts()` degrades and every listing page renders as an
    // empty blog. It therefore gets the same one-shot transient retry as the
    // file reads — a rate limit here costs the entire site's content, not one
    // post, so it is the last place to be casual about it.
    const tree = await this.fetchTreeWithRetry().catch((err: unknown) => {
      // A fresh repo has no commits (and thus no branch tree) yet. Treat that
      // as empty rather than crashing the dashboard. A 404 can also mean the
      // configured branch doesn't exist — logged so it's diagnosable.
      if (isNotFound(err)) {
        console.warn(
          `[GitHubApiAdapter] Branch "${this.options.branch}" has no commits ` +
            `or doesn't exist in ${this.owner}/${this.repo} — treating the ` +
            `content folder as empty. If this repo isn't brand new, check GITHUB_BRANCH.`
        );
        return { data: { tree: [], truncated: false } };
      }
      throw err;
    });

    const treeSha =
      "sha" in tree.data && typeof tree.data.sha === "string"
        ? tree.data.sha
        : null;
    if (treeSha) {
      const cached = this.listCache.get(treeSha);
      if (cached) return cached;
    }

    const prefix = `${this.options.postsPath}/`;
    const files =
      tree.data.tree?.filter(
        (t) =>
          t.type === "blob" &&
          !!t.path?.startsWith(prefix) &&
          t.path.endsWith(".md")
      ) ?? [];

    // Frontmatter requires the file body, so listing N posts costs N content
    // reads on top of the single tree call. Doing that sequentially costs N
    // round-trip latencies — with a few dozen posts that is the dominant cost
    // of any uncached page, and it is why the home page was measurably slower
    // than every ISR route.
    //
    // The width is a latency/limits trade-off and it is deliberately modest.
    // Width 16 was measured as ~20% faster than 8, but concurrency does not
    // change the *number* of calls, only how fast they arrive - and a burst is
    // exactly what trips GitHub's secondary rate limit. Since a rate limit
    // here does not degrade one post, it blanks the entire site, the slower
    // option is clearly the right default. Raise this only with evidence, and
    // never above a small fraction of GitHub's 100-concurrent ceiling.
    const rawPosts = await mapWithConcurrency(files, 8, (file) =>
      file.path ? this.getFileRaw(file.path) : Promise.resolve(null)
    );

    const posts: PostMeta[] = [];
    for (const raw of rawPosts) {
      if (!raw) continue;
      const { data } = matter(raw.content);
      posts.push(normalizeFrontmatter(data as Record<string, unknown>));
    }

    posts.sort((a, b) => b.date.localeCompare(a.date));
    if (treeSha) this.listCache.set(treeSha, posts);
    return posts;
  }

  async getPost(slug: string): Promise<Post | null> {
    // Slugs become repo paths — reject traversal attempts before they can
    // address files outside the configured posts folder.
    if (!isSafeSlug(slug)) return null;
    const cached = this.postCache.get(slug);
    if (cached !== undefined) return cached;

    const filePath = this.filePath(slug);
    const raw = await this.getFileRaw(filePath);
    if (!raw) {
      this.postCache.set(slug, null);
      return null;
    }

    const { data, content } = matter(raw.content);
    const meta = { ...normalizeFrontmatter(data as Record<string, unknown>), slug };
    const post: Post = { meta, content, fileName: `${slug}.md` };
    this.postCache.set(slug, post);
    return post;
  }

  /* ------------------------------ Writes --------------------------------- */

  async savePost(slug: string, content: string, frontmatter: object): Promise<void> {
    if (!isSafeSlug(slug)) {
      throw new Error(`Refusing to save post with unsafe slug: ${JSON.stringify(slug)}`);
    }
    const meta = normalizeFrontmatter(frontmatter as Record<string, unknown>);
    const filePath = this.filePath(slug);
    const serialized = matter.stringify(content, { ...meta, slug });

    // No-op saves (autosave firing on an unchanged post) must not create an
    // empty commit — mirror the LocalGitAdapter's "nothing to commit" behavior.
    const current = await this.getFileRaw(filePath);
    if (current && current.content === serialized) {
      return;
    }

    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: filePath,
      message: `Post: ${slug}`,
      content: Buffer.from(serialized, "utf8").toString("base64"),
      branch: this.options.branch,
      ...(current?.sha ? { sha: current.sha } : {}),
    });

    this.listCache.invalidate();
    this.postCache.invalidate(slug);
  }

  async deletePost(slug: string): Promise<void> {
    if (!isSafeSlug(slug)) return; // never resolve a hostile slug to a repo path
    const filePath = this.filePath(slug);
    const sha = await this.getFileSha(filePath);
    if (!sha) return;

    await this.octokit.rest.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path: filePath,
      message: `Delete: ${slug}`,
      sha,
      branch: this.options.branch,
    });

    this.listCache.invalidate();
    this.postCache.invalidate(slug);
  }

  /* --------------------------- Site config -------------------------------- */

  async getSiteConfig(): Promise<SiteConfig> {
    const cached = this.configCache.get("config");
    if (cached) return cached;

    const raw = await this.getFileRaw(this.options.configPath);
    if (!raw) {
      this.configCache.set("config", DEFAULT_SITE_CONFIG);
      return DEFAULT_SITE_CONFIG;
    }
    try {
      const config = siteConfigSchema.parse(JSON.parse(raw.content));
      this.configCache.set("config", config);
      return config;
    } catch {
      this.configCache.set("config", DEFAULT_SITE_CONFIG);
      return DEFAULT_SITE_CONFIG;
    }
  }

  async saveSiteConfig(config: SiteConfig): Promise<void> {
    const content = `${JSON.stringify(config, null, 2)}
`;

    // Same no-op guard as savePost — don't commit unchanged config.
    const current = await this.getFileRaw(this.options.configPath);
    if (current && current.content === content) {
      return;
    }

    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: this.options.configPath,
      message: "Update site config",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: this.options.branch,
      ...(current?.sha ? { sha: current.sha } : {}),
    });

    this.configCache.invalidate();
  }
}
