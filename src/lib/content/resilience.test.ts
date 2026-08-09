import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Regression tests for the graceful-read contract: public surfaces must never
 * fail a build or 500 when the content adapter is unreachable (e.g. a
 * serverless build without GITHUB_REPO/GITHUB_TOKEN), while admin/API write
 * paths still surface errors loudly.
 *
 * These exercise the real modules against real environment states (no module
 * mocking): each test gets a fresh module graph so the adapter + config caches
 * can't leak between scenarios.
 */

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ansora-resilience-"));
  // A content dir with one post + a site config the happy path can read.
  await fs.mkdir(path.join(tmpDir, "posts"), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, "posts", "hello.md"),
    [
      "---",
      "title: Hello",
      "slug: hello",
      "date: 2026-01-15",
      "excerpt: Hi there.",
      "published: true",
      "---",
      "",
      "Body text.",
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(tmpDir, "site.config.json"),
    JSON.stringify({ title: "Mine" }, null, 2),
    "utf8"
  );
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.stubEnv("DEPLOYMENT_MODE", "self-hosted");
  vi.stubEnv("CONTENT_DIR", tmpDir);
  vi.stubEnv("GITHUB_REPO", "");
  vi.stubEnv("GITHUB_TOKEN", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Fresh module graph per call — isolates the adapter + config caches. */
async function freshModules() {
  vi.resetModules();
  const content = await import("./index");
  const siteConfig = await import("../site-config");
  return { content, siteConfig };
}

describe("safeListPosts", () => {
  it("returns posts when the adapter works", async () => {
    const { content } = await freshModules();
    const posts = await content.safeListPosts();
    expect(posts.map((p: { slug: string }) => p.slug)).toContain("hello");
  });

  it("returns [] (never throws) when serverless creds are missing", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "serverless");
    vi.stubEnv("GITHUB_REPO", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    const { content } = await freshModules();
    await expect(content.safeListPosts()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("getSiteConfig", () => {
  it("returns the adapter config when reachable", async () => {
    const { siteConfig } = await freshModules();
    await expect(siteConfig.getSiteConfig()).resolves.toMatchObject({
      title: "Mine",
    });
  });

  it("falls back to DEFAULT_SITE_CONFIG when the adapter is unreachable", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "serverless");
    vi.stubEnv("GITHUB_REPO", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    const { siteConfig } = await freshModules();
    const config = await siteConfig.getSiteConfig();
    expect(config.title).toBe("Ansora");
    expect(console.warn).toHaveBeenCalled();
  });
});
