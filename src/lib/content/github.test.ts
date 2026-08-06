import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubApiAdapter } from "./github";
import { DEFAULT_SITE_CONFIG } from "./types";

type GetContentArgs = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
};
type PutArgs = GetContentArgs & {
  message: string;
  content: string;
  branch: string;
  sha?: string;
};
type DeleteArgs = {
  owner: string;
  repo: string;
  path: string;
  message: string;
  sha: string;
  branch: string;
};
type GetTreeArgs = {
  owner: string;
  repo: string;
  tree_sha: string;
  recursive?: string;
};

const mocks = vi.hoisted(() => ({
  getContent: vi.fn<(args: GetContentArgs) => Promise<unknown>>(),
  createOrUpdateFileContents: vi.fn<(args: PutArgs) => Promise<unknown>>(),
  deleteFile: vi.fn<(args: DeleteArgs) => Promise<unknown>>(),
  getTree: vi.fn<(args: GetTreeArgs) => Promise<unknown>>(),
}));

vi.mock("octokit", () => ({
  Octokit: class {
    rest = {
      repos: {
        getContent: mocks.getContent,
        createOrUpdateFileContents: mocks.createOrUpdateFileContents,
        deleteFile: mocks.deleteFile,
      },
      git: { getTree: mocks.getTree },
    };
  },
}));

/** A getContent response holding one UTF-8 file (base64 content + sha). */
function file(markdown: string, sha = "sha-1") {
  return {
    data: {
      content: Buffer.from(markdown, "utf8").toString("base64"),
      sha,
    },
  };
}

const OPTIONS = {
  repo: "acme/content",
  token: "test-token",
  branch: "main",
  postsPath: "content/posts",
  configPath: "content/site.config.json",
};

function makeAdapter(): GitHubApiAdapter {
  return new GitHubApiAdapter(OPTIONS);
}

describe("GitHubApiAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: files are missing and the repo tree is empty.
    mocks.getContent.mockRejectedValue({ status: 404 });
    mocks.getTree.mockResolvedValue({ data: { tree: [] } });
  });

  it("validates the repo format at construction", () => {
    expect(
      () => new GitHubApiAdapter({ ...OPTIONS, repo: "not-a-repo" })
    ).toThrow(/owner\/repo/);
  });

  describe("reads", () => {
    it("parses a post from the Contents API and caches it", async () => {
      const md = [
        "---",
        "title: Hello",
        "date: 2026-01-15",
        "excerpt: Hi",
        "published: true",
        "---",
        "",
        "Body here.",
      ].join("\n");
      mocks.getContent.mockResolvedValue(file(md, "sha-abc"));

      const adapter = makeAdapter();
      const post = await adapter.getPost("hello");

      expect(post?.meta.title).toBe("Hello");
      expect(post?.meta.slug).toBe("hello");
      // The body round-trips (leading/trailing whitespace depends on how the
      // file was written, so compare trimmed).
      expect(post?.content.trim()).toBe("Body here.");
      expect(post?.fileName).toBe("hello.md");
      expect(mocks.getContent).toHaveBeenCalledWith(
        expect.objectContaining({ path: "content/posts/hello.md", ref: "main" })
      );

      // Second read is served from the TTL cache — no extra API call.
      await adapter.getPost("hello");
      expect(mocks.getContent).toHaveBeenCalledTimes(1);
    });

    it("returns null for a missing post", async () => {
      expect(await makeAdapter().getPost("missing")).toBeNull();
    });

    it("lists only .md posts under the posts path, newest first", async () => {
      mocks.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "content/posts/a.md", type: "blob" },
            { path: "content/posts/b.md", type: "blob" },
            { path: "content/posts/notes.txt", type: "blob" },
            { path: "content/drafts/c.md", type: "blob" },
            { path: "content/posts/sub/d.md", type: "blob" },
          ],
        },
      });
      mocks.getContent.mockImplementation(async ({ path }) =>
        file(
          [
            "---",
            `title: ${path}`,
            `date: ${path.endsWith("a.md") ? "2026-02-01" : "2025-01-01"}`,
            "---",
            "",
            "x",
          ].join("\n")
        )
      );

      const adapter = makeAdapter();
      const posts = await adapter.listPosts();

      expect(posts.map((p) => p.title)).toEqual([
        "content/posts/a.md",
        "content/posts/b.md",
        "content/posts/sub/d.md",
      ]);
      expect(posts[0].title).toBe("content/posts/a.md");

      // Cached — the tree is only fetched once.
      await adapter.listPosts();
      expect(mocks.getTree).toHaveBeenCalledTimes(1);
    });

    it("treats a branch-less repo (404 tree) as empty", async () => {
      mocks.getTree.mockRejectedValue({ status: 404 });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(await makeAdapter().listPosts()).toEqual([]);
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });

    it("parses site config and falls back to defaults", async () => {
      mocks.getContent.mockResolvedValue(
        file(JSON.stringify({ title: "My Blog" }), "sha-c")
      );
      expect((await makeAdapter().getSiteConfig()).title).toBe("My Blog");

      // Missing file → defaults.
      mocks.getContent.mockRejectedValue({ status: 404 });
      expect((await makeAdapter().getSiteConfig()).title).toBe(
        DEFAULT_SITE_CONFIG.title
      );

      // Corrupt JSON → defaults.
      mocks.getContent.mockResolvedValue(file("{not json", "sha-c"));
      expect((await makeAdapter().getSiteConfig()).title).toBe(
        DEFAULT_SITE_CONFIG.title
      );
    });
  });

  describe("writes", () => {
    it("creates a new file without a sha when it doesn't exist", async () => {
      await makeAdapter().savePost("hello", "Body.", { title: "Hello", date: "2026-01-15" });

      expect(mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
      const args = mocks.createOrUpdateFileContents.mock.calls[0][0];
      expect(args).toMatchObject({
        owner: "acme",
        repo: "content",
        path: "content/posts/hello.md",
        branch: "main",
        message: "Post: hello",
      });
      expect(args.sha).toBeUndefined();
      const decoded = Buffer.from(args.content, "base64").toString("utf8");
      expect(decoded).toContain("title: Hello");
      expect(decoded).toContain("Body.");
    });

    it("passes the current sha when updating an existing file", async () => {
      mocks.getContent.mockResolvedValue(file("old body", "sha-abc"));
      await makeAdapter().savePost("hello", "new body", { title: "Hello", date: "2026-01-15" });

      const args = mocks.createOrUpdateFileContents.mock.calls[0][0];
      expect(args.sha).toBe("sha-abc");
    });

    it("skips the write entirely when the serialized content is unchanged", async () => {
      const adapter = makeAdapter();

      // First save creates the file; capture exactly what was serialized.
      await adapter.savePost("hello", "Body.", { title: "Hello", date: "2026-01-15" });
      const created = mocks.createOrUpdateFileContents.mock.calls[0][0];
      const serialized = Buffer.from(created.content, "base64").toString("utf8");

      // Repo now holds that exact content → re-save must be a no-op.
      mocks.getContent.mockResolvedValue(file(serialized, "sha-abc"));
      await adapter.savePost("hello", "Body.", { title: "Hello", date: "2026-01-15" });

      expect(mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
    });

    it("deletes a file with its sha", async () => {
      mocks.getContent.mockResolvedValue(file("x", "sha-del"));
      await makeAdapter().deletePost("hello");

      expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
      expect(mocks.deleteFile.mock.calls[0][0]).toMatchObject({
        path: "content/posts/hello.md",
        sha: "sha-del",
        message: "Delete: hello",
        branch: "main",
      });
    });

    it("does nothing when deleting a missing file", async () => {
      await makeAdapter().deletePost("hello");
      expect(mocks.deleteFile).not.toHaveBeenCalled();
    });

    it("creates, updates and skips no-op site config saves", async () => {
      const adapter = makeAdapter();

      // Create (no existing file → no sha).
      await adapter.saveSiteConfig({ ...DEFAULT_SITE_CONFIG, title: "First" });
      const created = mocks.createOrUpdateFileContents.mock.calls[0][0];
      expect(created.sha).toBeUndefined();
      expect(created.message).toBe("Update site config");

      // No-op: repo holds the exact same content → nothing written.
      const serialized = Buffer.from(created.content, "base64").toString("utf8");
      mocks.getContent.mockResolvedValue(file(serialized, "sha-cfg"));
      await adapter.saveSiteConfig({ ...DEFAULT_SITE_CONFIG, title: "First" });
      expect(mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);

      // Update: different content → sha is passed.
      mocks.getContent.mockResolvedValue(file(serialized, "sha-cfg"));
      await adapter.saveSiteConfig({ ...DEFAULT_SITE_CONFIG, title: "Second" });
      expect(mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(2);
      expect(mocks.createOrUpdateFileContents.mock.calls[1][0].sha).toBe("sha-cfg");
    });
  });
});
