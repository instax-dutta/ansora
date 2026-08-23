import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isSafeSlug } from "./slug";
import { LocalGitAdapter } from "./local-git";

/**
 * Regression tests for the slug safety gate: a hostile slug (path traversal,
 * nested paths, empty) must never resolve to a file outside the posts
 * directory, in either adapter.
 */
describe("isSafeSlug", () => {
  it.each([
    "hello-world",
    "post-2026",
    "a",
    ...["a".repeat(200)],
  ])("accepts %s", (slug) => {
    expect(isSafeSlug(slug)).toBe(true);
  });

  it.each([
    "",
    "../escape",
    "../../etc/passwd",
    "a/b",
    "..",
    ".hidden",
    "UPPER-case",
    "space slug",
    "null%00byte",
    "a".repeat(201),
    null,
    undefined,
    42,
  ])("rejects %j", (slug) => {
    expect(isSafeSlug(slug)).toBe(false);
  });
});

describe("LocalGitAdapter slug traversal guard", () => {
  let dir: string;
  let adapter: LocalGitAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ansora-traversal-"));
    adapter = new LocalGitAdapter(dir);
    // A decoy file OUTSIDE the content dir that traversal would reach.
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("getPost returns null for traversal slugs instead of reading outside the posts dir", async () => {
    for (const hostile of ["../secret", "a/../..%2f", "foo/bar"]) {
      expect(await adapter.getPost(hostile)).toBeNull();
    }
  });

  it("savePost refuses to write outside the posts dir", async () => {
    const outside = path.join(path.dirname(dir), "escaped.md");
    await expect(
      adapter.savePost("../escaped", "pwned", { title: "x" })
    ).rejects.toThrow(/unsafe slug/i);
    await expect(readFile(outside)).rejects.toThrow();
  });

  it("deletePost no-ops for traversal slugs instead of deleting outside files", async () => {
    const sentinelDir = await mkdtemp(path.join(tmpdir(), "ansora-decoy-"));
    const sentinel = path.join(sentinelDir, "target.md");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(sentinel, "keep me");
    // "../<tmpname>/target" would escape the posts dir if unguarded.
    await adapter.deletePost(`../${path.basename(sentinelDir)}/target`);
    const { access } = await import("node:fs/promises");
    await expect(access(sentinel)).resolves.toBeUndefined();
    await rm(sentinelDir, { recursive: true, force: true });
  });
});
