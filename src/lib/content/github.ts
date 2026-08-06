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
import type { ContentAdapter } from "./index";
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
    (err as { status?: number }).status === 404
  );
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

  private async getFileRaw(filePath: string): Promise<{ content: string; sha: string } | null> {
    try {
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
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  private async getFileSha(filePath: string): Promise<string | null> {
    const file = await this.getFileRaw(filePath);
    return file?.sha ?? null;
  }

  /* ------------------------------ Reads ---------------------------------- */

  async listPosts(): Promise<PostMeta[]> {
    const cached = this.listCache.get("all");
    if (cached) return cached;

    // One recursive tree call to enumerate files, then a contents call per
    // post to parse frontmatter. A 60s cache keeps this cheap in practice.
    const tree = await this.octokit.rest.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: this.options.branch,
      recursive: "true",
    }).catch((err: unknown) => {
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

    const prefix = `${this.options.postsPath}/`;
    const files =
      tree.data.tree?.filter(
        (t) =>
          t.type === "blob" &&
          !!t.path?.startsWith(prefix) &&
          t.path.endsWith(".md")
      ) ?? [];

    const posts: PostMeta[] = [];
    for (const file of files) {
      if (!file.path) continue;
      const raw = await this.getFileRaw(file.path);
      if (!raw) continue;
      const { data } = matter(raw.content);
      posts.push(normalizeFrontmatter(data as Record<string, unknown>));
    }

    posts.sort((a, b) => b.date.localeCompare(a.date));
    this.listCache.set("all", posts);
    return posts;
  }

  async getPost(slug: string): Promise<Post | null> {
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
    const content = `${JSON.stringify(config, null, 2)}\n`;

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
