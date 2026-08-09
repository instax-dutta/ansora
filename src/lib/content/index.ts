/**
 * Content adapter pattern.
 *
 * All content I/O goes through this interface. The implementation is chosen
 * once at runtime from DEPLOYMENT_MODE:
 *   - self-hosted -> LocalGitAdapter  (disk + git commits, instant)
 *   - serverless  -> GitHubApiAdapter (GitHub REST API, per-save commits)
 *
 * No other code branches on the deployment mode.
 */
import path from "node:path";
import { GitHubApiAdapter } from "./github";
import { LocalGitAdapter } from "./local-git";
import type { Post, PostMeta, SiteConfig } from "./types";

export interface ContentAdapter {
  readonly mode: "self-hosted" | "serverless";

  listPosts(): Promise<PostMeta[]>;
  getPost(slug: string): Promise<Post | null>;
  savePost(slug: string, content: string, frontmatter: object): Promise<void>;
  deletePost(slug: string): Promise<void>;

  /** Site-level settings stored in site.config.json, managed via the adapter. */
  getSiteConfig(): Promise<SiteConfig>;
  saveSiteConfig(config: SiteConfig): Promise<void>;
}

let cachedAdapter: ContentAdapter | null = null;

export function getAdapter(): ContentAdapter {
  if (cachedAdapter) return cachedAdapter;

  if (process.env.DEPLOYMENT_MODE === "serverless") {
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (!repo || !token) {
      throw new Error(
        "DEPLOYMENT_MODE=serverless requires GITHUB_REPO and GITHUB_TOKEN env vars."
      );
    }
    cachedAdapter = new GitHubApiAdapter({
      repo,
      token,
      branch: process.env.GITHUB_BRANCH || "main",
      postsPath: process.env.GITHUB_CONTENT_PATH || "content/posts",
      configPath: process.env.GITHUB_SITE_CONFIG_PATH || "content/site.config.json",
    });
  } else {
    const contentDir =
      process.env.CONTENT_DIR || path.join(process.cwd(), "content");
    cachedAdapter = new LocalGitAdapter(contentDir);
  }

  return cachedAdapter;
}

/**
 * Read-only list for public surfaces (home, tags, sitemap, feeds). Never
 * throws: if the adapter is unreachable (e.g. a serverless build without
 * GITHUB_REPO/GITHUB_TOKEN, or a transient API error) it returns [] so pages
 * and prerenders degrade gracefully instead of 500ing or failing the build.
 * Admin/API write paths still surface adapter errors loudly.
 */
export async function safeListPosts(): Promise<PostMeta[]> {
  try {
    return await getAdapter().listPosts();
  } catch (err) {
    // Mirrors the getSiteConfig() fallback: public surfaces degrade to empty
    // rather than 500ing or failing a prerender, but the failure is logged so
    // it stays diagnosable (e.g. a transient GitHub API error would otherwise
    // silently show "Nothing published yet").
    console.warn("[content] listPosts unavailable — serving empty post list:", err);
    return [];
  }
}

/** Re-export the model types for convenience. */
export type { Post, PostMeta, SiteConfig } from "./types";
export { DEFAULT_SITE_CONFIG } from "./types";
