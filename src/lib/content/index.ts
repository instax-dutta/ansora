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
 * Last failure of the *public* post listing, for rendering purposes.
 *
 * Why this exists: `safeListPosts()` degrades to `[]` so a public route never
 * 500s. That is the right call for uptime and the wrong one for honesty — an
 * empty array and "the content API is unreachable" are indistinguishable at the
 * call site, so a transient GitHub outage used to render a working blog as
 * "Nothing published yet". To an author that is indistinguishable from losing
 * every post, and to a crawler it looks exactly like the site was deleted.
 *
 * So the degradation is still silent to the type system but no longer silent to
 * the reader: listing pages check `listStatus()` and say what actually
 * happened. Per-instance state, like every other cache here.
 */
let lastListFailure: { at: number; message: string } | null = null;

export interface ListStatus {
  /** False when the last public listing degraded rather than succeeded. */
  ok: boolean;
  /** Short, human-readable reason. Safe to show; never a stack trace. */
  reason: string | null;
  /** Epoch ms of the failure, for diagnostics. */
  at: number | null;
}

export function listStatus(): ListStatus {
  return lastListFailure
    ? { ok: false, reason: lastListFailure.message, at: lastListFailure.at }
    : { ok: true, reason: null, at: null };
}

/** Test seam: clear the recorded failure. */
export function resetListStatus(): void {
  lastListFailure = null;
}

/**
 * Read-only list for public surfaces (home, tags, sitemap, feeds). Never
 * throws: if the adapter is unreachable (e.g. a serverless build without
 * GITHUB_REPO/GITHUB_TOKEN, or a transient API error) it returns [] so pages
 * and prerenders degrade gracefully instead of 500ing or failing the build.
 * Admin/API write paths still surface adapter errors loudly.
 *
 * The failure is recorded in `listStatus()` so a page can distinguish "no
 * posts" from "could not reach the content store".
 */
export async function safeListPosts(): Promise<PostMeta[]> {
  try {
    const posts = await getAdapter().listPosts();
    lastListFailure = null;
    return posts;
  } catch (err) {
    // Mirrors the getSiteConfig() fallback: public surfaces degrade to empty
    // rather than 500ing or failing a prerender, but the failure is recorded so
    // the page can report it instead of claiming the blog is empty.
    lastListFailure = {
      at: Date.now(),
      message: describeAdapterError(err),
    };
    console.warn("[content] listPosts unavailable — serving empty post list:", err);
    return [];
  }
}

/**
 * A short, safe description of an adapter failure.
 *
 * This string reaches the rendered page, so it must never leak a token, an
 * Authorization header, or a stack trace. Octokit errors can embed the request
 * that failed, which carries auth headers, so the message is scrubbed and
 * truncated. Exported because credential scrubbing is a security property and
 * deserves a test of its own.
 */
export function describeAdapterError(err: unknown): string {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message)
      : String(err);

  // 403 and 429 are the actionable case and get a specific, non-technical
  // message; the raw upstream text would be noise to an author.
  if (status === 403 || status === 429) {
    return "The content store rejected the request (rate limited or unauthorized).";
  }
  if (typeof status === "number") {
    return `The content store returned an error (HTTP ${status}).`;
  }

  const scrubbed = raw
    .replace(
      /\b(gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,})\b/g,
      "[redacted]"
    )
    .replace(/\b(authorization|token|secret|api[-_]?key)\b\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .slice(0, 200);
  return `The content store could not be reached: ${scrubbed}`;
}

/** Re-export the model types for convenience. */
export type { Post, PostMeta, SiteConfig } from "./types";
export { DEFAULT_SITE_CONFIG } from "./types";
