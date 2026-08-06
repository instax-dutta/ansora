// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostEditor } from "./PostEditor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// The live preview is not the subject of these tests; a stub keeps the suite
// fast and avoids pulling Shiki/react-markdown into the shortcut tests.
vi.mock("@/components/Markdown", () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="preview">{children}</div>
  ),
}));

/** Passive Image stub — never resolves, so the dialog's URL check stays quiet. */
class NoopImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  naturalWidth = 0;
  naturalHeight = 0;
}

function renderEditor() {
  const utils = render(<PostEditor post={null} />);
  const textarea = screen.getByLabelText("Post content (Markdown)") as HTMLTextAreaElement;
  return {
    textarea,
    typeBody: (text: string) => {
      fireEvent.change(textarea, { target: { value: text } });
    },
    select: (start: number, end: number) => {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    },
    press: (init: KeyboardEventInit) => fireEvent.keyDown(window, init),
    ...utils,
  };
}

beforeEach(() => {
  vi.stubGlobal("Image", NoopImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PostEditor — Markdown shortcuts", () => {
  it("wraps the selection in bold with Ctrl+B", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    press({ key: "b", ctrlKey: true });
    expect(textarea.value).toBe("hello **world**!");
  });

  it("wraps with Cmd+B too (macOS modifier)", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    press({ key: "b", metaKey: true });
    expect(textarea.value).toBe("hello **world**!");
  });

  it("italicizes with Ctrl+I", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    press({ key: "i", ctrlKey: true });
    expect(textarea.value).toBe("hello *world*!");
  });

  it("turns the selection into a link with Ctrl+K", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("check my site");
    select(6, 14);
    press({ key: "k", ctrlKey: true });
    expect(textarea.value).toBe("check [my site](https://example.com)");
  });

  it("inserts a heading 2 with Ctrl+Shift+H", () => {
    const { textarea, typeBody, press } = renderEditor();
    typeBody("intro");
    textarea.focus();
    textarea.setSelectionRange(5, 5);
    press({ key: "h", shiftKey: true, ctrlKey: true });
    expect(textarea.value).toBe("intro\n## Heading\n\n");
  });

  it("inserts a bullet with Ctrl+Shift+7 (matches the physical Digit7 key)", () => {
    const { textarea, typeBody, press } = renderEditor();
    typeBody("intro");
    textarea.focus();
    textarea.setSelectionRange(5, 5);
    press({ key: "&", code: "Digit7", shiftKey: true, ctrlKey: true });
    expect(textarea.value).toBe("intro\n- ");
  });

  it("inserts a code fence with Ctrl+Shift+E", () => {
    const { textarea, typeBody, press } = renderEditor();
    typeBody("intro");
    textarea.focus();
    textarea.setSelectionRange(5, 5);
    press({ key: "e", shiftKey: true, ctrlKey: true });
    expect(textarea.value).toBe("intro\n```\n\n```\n");
  });

  it("does not fire shortcuts when the textarea is not focused", () => {
    const { textarea, typeBody, press } = renderEditor();
    typeBody("hello world!");
    screen.getByLabelText("Title").focus();
    press({ key: "b", ctrlKey: true });
    expect(textarea.value).toBe("hello world!");
  });

  it("does not fire on a plain key without the modifier", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    press({ key: "b" });
    expect(textarea.value).toBe("hello world!");
  });

  it("ignores shortcuts when Alt is held", () => {
    const { textarea, typeBody, select, press } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    press({ key: "b", ctrlKey: true, altKey: true });
    expect(textarea.value).toBe("hello world!");
  });
});

describe("PostEditor — image dialog wiring", () => {
  it("opens the dialog with a URL prefill from a selected URL (Ctrl+Shift+K)", () => {
    const { typeBody, select, press } = renderEditor();
    typeBody("see https://example.com/hero.png now");
    select(4, 32);
    press({ key: "k", shiftKey: true, ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Insert image" })).toBeInTheDocument();
    expect(screen.getByLabelText("Image URL")).toHaveValue("https://example.com/hero.png");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prefills the alt text from a non-URL selection", () => {
    const { typeBody, select, press } = renderEditor();
    typeBody("add a photo of a cat here");
    select(4, 20);
    press({ key: "k", shiftKey: true, ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Insert image" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Alt text/)).toHaveValue("a photo of a cat");
  });

  it("opens the dialog from the toolbar button", () => {
    const { typeBody, select } = renderEditor();
    typeBody("see https://example.com/x.png");
    select(4, 28);
    fireEvent.click(screen.getByRole("button", { name: /Insert image/ }));
    expect(screen.getByRole("dialog", { name: "Insert image" })).toBeInTheDocument();
  });
});

describe("PostEditor — toolbar buttons", () => {
  it("applies bold from the toolbar button", () => {
    const { textarea, typeBody, select } = renderEditor();
    typeBody("hello world!");
    select(6, 11);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(textarea.value).toBe("hello **world**!");
  });

  it("toggles the shortcuts cheatsheet from the toolbar, tracking aria-expanded", () => {
    renderEditor();
    const toggle = screen.getByRole("button", { name: /Keyboard shortcuts/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    // The ⌨ button's own mousedown is stopped so its click toggle can close it.
    fireEvent.mouseDown(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });
});
