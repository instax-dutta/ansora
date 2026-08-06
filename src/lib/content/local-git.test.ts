import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalGitAdapter } from "./local-git";

const META = {
  title: "Test Post",
  date: "2026-01-15",
  excerpt: "An excerpt.",
  tags: ["test"],
  published: true,
};

describe("LocalGitAdapter", () => {
  let dir: string;
  let adapter: LocalGitAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ansora-test-"));
    adapter = new LocalGitAdapter(dir);
    delete process.env.GIT_AUTO_PUSH;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const commitCount = async (): Promise<number> => {
    // Only trust git.log() when THIS dir is a repo — otherwise an ancestor
    // git work tree (e.g. TMPDIR inside a checkout) would leak its commits.
    const isRepo = await access(path.join(dir, ".git")).then(
      () => true,
      () => false
    );
    if (!isRepo) return 0;
    try {
      const log = await simpleGit({ baseDir: dir }).log();
      return log.total;
    } catch {
      return 0;
    }
  };

  const lastMessage = async (): Promise<string> => {
    const log = await simpleGit({ baseDir: dir }).log();
    return log.latest?.message ?? "";
  };

  describe("posts", () => {
    it("writes a committed markdown file on save", async () => {
      await adapter.savePost("hello-world", "Body text.", META);

      const file = await readFile(path.join(dir, "posts/hello-world.md"), "utf8");
      expect(file).toContain("title: Test Post");
      expect(file).toContain("Body text.");
      expect(await commitCount()).toBe(1);
      expect(await lastMessage()).toBe("Post: hello-world");
    });

    it("round-trips a post through getPost", async () => {
      await adapter.savePost("hello-world", "Body text.", META);
      const post = await adapter.getPost("hello-world");

      expect(post).not.toBeNull();
      expect(post!.meta.title).toBe("Test Post");
      expect(post!.meta.published).toBe(true);
      expect(post!.meta.slug).toBe("hello-world");
      // The body round-trips (compare trimmed — see github.test.ts).
      expect(post!.content.trim()).toBe("Body text.");
      expect(post!.fileName).toBe("hello-world.md");
    });

    it("returns null for a missing post", async () => {
      expect(await adapter.getPost("nope")).toBeNull();
    });

    it("does not create a commit for an unchanged re-save", async () => {
      await adapter.savePost("hello-world", "Body text.", META);
      await adapter.savePost("hello-world", "Body text.", META);
      expect(await commitCount()).toBe(1);
    });

    it("creates a new commit when the content changes", async () => {
      await adapter.savePost("hello-world", "Body text.", META);
      await adapter.savePost("hello-world", "Updated body.", META);
      expect(await commitCount()).toBe(2);
      expect(await lastMessage()).toBe("Post: hello-world");
    });

    it("lists posts newest-first and ignores non-markdown files", async () => {
      await adapter.savePost("older", "A", { ...META, date: "2025-06-01" });
      await adapter.savePost("newer", "B", { ...META, date: "2026-01-15" });
      await writeFile(path.join(dir, "posts/notes.txt"), "not a post");

      const posts = await adapter.listPosts();
      expect(posts.map((p) => p.slug)).toEqual(["newer", "older"]);
    });

    it("skips unreadable files instead of breaking the list", async () => {
      await adapter.savePost("fine", "A", META);
      // A directory named like a post makes readFile throw — must be skipped.
      await mkdir(path.join(dir, "posts/broken.md"), { recursive: true });

      const posts = await adapter.listPosts();
      expect(posts.map((p) => p.slug)).toEqual(["fine"]);
    });

    it("deletes a post and commits the removal", async () => {
      await adapter.savePost("hello-world", "Body text.", META);
      await adapter.deletePost("hello-world");

      expect(await adapter.getPost("hello-world")).toBeNull();
      expect(await commitCount()).toBe(2);
      expect(await lastMessage()).toBe("Delete: hello-world");
    });

    it("deleting a missing post is a harmless no-op", async () => {
      await adapter.deletePost("nope");
      expect(await commitCount()).toBe(0);
    });
  });

  describe("site config", () => {
    it("seeds defaults on first read without creating git history", async () => {
      const config = await adapter.getSiteConfig();

      expect(config.title).toBe("Ansora");
      const file = await readFile(path.join(dir, "site.config.json"), "utf8");
      expect(JSON.parse(file).title).toBe("Ansora");
      // Seeding is a read-only operation — no repo, no commits.
      expect(await commitCount()).toBe(0);
    });

    it("reads an existing config", async () => {
      await writeFile(
        path.join(dir, "site.config.json"),
        JSON.stringify({ title: "My Blog" })
      );
      expect((await adapter.getSiteConfig()).title).toBe("My Blog");
    });

    it("falls back to defaults on corrupt JSON", async () => {
      await writeFile(path.join(dir, "site.config.json"), "{not json");
      expect((await adapter.getSiteConfig()).title).toBe("Ansora");
    });

    it("saves config with a commit", async () => {
      await adapter.saveSiteConfig({ ...(await adapter.getSiteConfig()), title: "New Title" });
      expect((await adapter.getSiteConfig()).title).toBe("New Title");
      expect(await commitCount()).toBe(1);
      expect(await lastMessage()).toBe("Update site config");
    });
  });
});
