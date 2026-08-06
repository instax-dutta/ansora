// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageDialog } from "./ImageDialog";

/**
 * window.Image is stubbed with a controllable class so tests can trigger
 * onload/onerror exactly like the browser would. Instances are recorded so
 * tests can assert on how many network checks happened (cache behavior).
 */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  naturalWidth = 0;
  naturalHeight = 0;
}

const instances: MockImage[] = [];
let urlSeq = 0;
const nextUrl = () => `https://cdn.example/img-${++urlSeq}.jpg`;

function renderDialog(props: Partial<React.ComponentProps<typeof ImageDialog>> = {}) {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <ImageDialog
      open
      onClose={onClose}
      initialUrl=""
      initialAlt=""
      focusKeyword=""
      onInsert={onInsert}
      {...props}
    />
  );
  return { onInsert, onClose, ...utils };
}

/**
 * Wait for the real 400ms debounce to fire the URL check, then settle it.
 * (userEvent v14 + vitest 4 fake timers hang, so the debounce runs on real
 * time and waitFor polls for the check to start.)
 */
async function waitForCheck() {
  await waitFor(() => expect(instances.length).toBeGreaterThan(0));
}

function settleLast(result: "ok" | "fail", width = 0, height = 0) {
  const img = instances[instances.length - 1];
  expect(img).toBeDefined();
  if (result === "ok") {
    img.naturalWidth = width;
    img.naturalHeight = height;
    act(() => img.onload?.());
  } else {
    act(() => img.onerror?.());
  }
}

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal(
    "Image",
    class extends MockImage {
      constructor() {
        super();
        instances.push(this);
      }
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageDialog — rendering & structure", () => {
  it("renders with the URL field focused and insert disabled while empty", async () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Insert image" })).toBeInTheDocument();
    const url = screen.getByLabelText("Image URL");
    await waitFor(() => expect(url).toHaveFocus());
    expect(screen.getByRole("button", { name: "Insert image" })).toBeDisabled();
  });

  it("labels the submit button 'Checking…' and disables it while a check is in flight", async () => {
    const user = userEvent.setup();
    renderDialog();
    // One paste = one input event = one debounce, so this cannot race.
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(nextUrl());
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Checking URL…");
  });
});

describe("ImageDialog — URL validation", () => {
  it("checks a pasted URL and reports success with image dimensions", async () => {
    const user = userEvent.setup();
    renderDialog();
    const url = nextUrl();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(url);
    expect(screen.getByText("Checking URL…")).toBeInTheDocument();

    await waitForCheck(); // debounce fires after ~400ms of real time
    settleLast("ok", 1200, 800);

    expect(screen.getByText(/Loads as an image \(1200×800\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert image" })).toBeEnabled();
  });

  it("flags a failing URL and lets the user insert anyway", async () => {
    const user = userEvent.setup();
    const { onInsert, onClose } = renderDialog();
    const url = nextUrl();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(url);
    await waitForCheck();
    settleLast("fail");

    expect(screen.getByText(/Couldn’t load this image/)).toBeInTheDocument();
    const insert = screen.getByRole("button", { name: "Insert image" });
    expect(insert).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Insert anyway" }));
    expect(insert).toBeEnabled();
    await user.click(insert);

    expect(onInsert).toHaveBeenCalledWith(url, "", "");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not insert when the URL failed and 'insert anyway' wasn't chosen", async () => {
    const user = userEvent.setup();
    const { onInsert, onClose } = renderDialog();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(nextUrl());
    await waitForCheck();
    settleLast("fail");

    // Enter in the URL field attempts implicit form submission, but the
    // disabled submit button blocks it — nothing is inserted or closed.
    await user.keyboard("{Enter}");
    expect(onInsert).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("blocks a direct form submission while the URL is invalid (handler guard)", async () => {
    // The disabled button already stops the realistic Enter path above; this
    // exercises the submit handler's own early-return guard, which only a
    // direct submit event can reach — fireEvent is the one remaining case
    // where it is the honest way to drive the form.
    const user = userEvent.setup();
    const { onInsert, onClose } = renderDialog();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(nextUrl());
    await waitForCheck();
    settleLast("fail");

    const form = screen.getByRole("dialog").querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onInsert).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reuses a cached result without a second network hit", async () => {
    const user = userEvent.setup();
    renderDialog();
    const urlInput = screen.getByLabelText("Image URL");
    const a = nextUrl();
    const b = nextUrl();

    await user.click(urlInput);
    await user.paste(a);
    await waitForCheck();
    settleLast("ok");
    expect(instances).toHaveLength(1);

    await user.clear(urlInput);
    await user.paste(b);
    await waitFor(() => expect(instances).toHaveLength(2));
    settleLast("ok");

    // Back to A: served from cache — no new Image created, valid immediately.
    await user.clear(urlInput);
    await user.paste(a);
    expect(instances).toHaveLength(2);
    expect(screen.getByText(/Loads as an image/)).toBeInTheDocument();
  });

  it("accepts relative paths (form has noValidate) and inserts them", async () => {
    const user = userEvent.setup();
    const { onInsert } = renderDialog();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste("/images/hero.png");
    await waitForCheck();
    settleLast("ok");

    await user.click(screen.getByRole("button", { name: "Insert image" }));
    expect(onInsert).toHaveBeenCalledWith("/images/hero.png", "", "");
  });

  it("prefills from the selection and validates it on open", async () => {
    const prefillUrl = nextUrl();
    renderDialog({ initialUrl: prefillUrl, initialAlt: "alt" });

    expect(screen.getByLabelText("Image URL")).toHaveValue(prefillUrl);
    await waitForCheck(); // mount auto-check
    settleLast("ok");

    expect(screen.getByText(/Loads as an image/)).toBeInTheDocument();
  });

  it("blocks malformed URLs and clears the error once they're fixed", async () => {
    const user = userEvent.setup();
    renderDialog();
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste("not a url");
    expect(
      screen.getByText(/URL must start with http\(s\):\/\/ or a \/-relative path\./)
    ).toBeInTheDocument();
    await user.clear(urlInput);
    await user.paste(nextUrl());
    expect(
      screen.queryByText(/URL must start with http\(s\):\/\/ or a \/-relative path\./)
    ).not.toBeInTheDocument();
  });
});

describe("ImageDialog — alt text guidance", () => {
  it("errors on missing alt text", () => {
    renderDialog({ initialAlt: "" });
    expect(screen.getByText(/Missing alt text/)).toBeInTheDocument();
  });

  it("warns on thin alt text", () => {
    renderDialog({ initialAlt: "a cat" });
    expect(screen.getByText(/A bit thin/)).toBeInTheDocument();
  });

  it("suggests weaving the focus keyword into good alt text", () => {
    renderDialog({
      initialAlt: "A cat sleeping on a windowsill",
      focusKeyword: "blog",
    });
    expect(screen.getByText(/weave “blog” in/)).toBeInTheDocument();
  });

  it("confirms descriptive alt text that already contains the keyword", () => {
    renderDialog({
      initialAlt: "A cat sleeping on a windowsill, today's blog topic",
      focusKeyword: "blog",
    });
    expect(screen.getByText(/Descriptive alt text/)).toBeInTheDocument();
  });

  it("updates the character counter as the user types", async () => {
    const user = userEvent.setup();
    renderDialog();
    // Let the mount auto-focus settle first — a pending rAF could otherwise
    // steal focus from the alt textarea mid-typing.
    await waitFor(() => expect(screen.getByLabelText("Image URL")).toHaveFocus());
    const alt = screen.getByLabelText(/Alt text/);
    await user.type(alt, "hello");
    expect(screen.getByText("5 chars")).toBeInTheDocument();
    await user.type(alt, " world");
    expect(screen.getByText("11 chars")).toBeInTheDocument();
  });
});

describe("ImageDialog — insert & close behavior", () => {
  it("sanitizes alt and title so they can't break the Markdown", async () => {
    const user = userEvent.setup();
    const url = nextUrl();
    const { onInsert, onClose } = renderDialog({
      initialUrl: url,
      initialAlt: "my [cat] pic",
    });
    await waitForCheck();
    settleLast("ok");

    await user.type(screen.getByLabelText("Title (optional tooltip)"), 'say "hi"');
    await user.click(screen.getByRole("button", { name: "Insert image" }));

    expect(onInsert).toHaveBeenCalledWith(url, "my cat pic", "say 'hi'");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    // role="dialog" lives on the portal wrapper; its first child is the backdrop.
    const backdrop = screen.getByRole("dialog").firstElementChild as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus within the dialog", async () => {
    const user = userEvent.setup();
    renderDialog();
    // Enable the submit button (the last focusable) via a successful check.
    const urlInput = screen.getByLabelText("Image URL");
    await user.click(urlInput);
    await user.paste(nextUrl());
    await waitForCheck();
    settleLast("ok");

    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).toBe(screen.getByRole("button", { name: "Close dialog" }));
    expect(last).toBe(screen.getByRole("button", { name: "Insert image" }));

    // user.tab() dispatches real Tab key events; the dialog's focus-trap
    // handler moves focus (it intercepts via preventDefault).
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("restores focus to the trigger button when closed", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <ImageDialog
            open={open}
            onClose={() => setOpen(false)}
            initialUrl=""
            initialAlt=""
            focusKeyword=""
            onInsert={() => {}}
          />
        </>
      );
    }
    render(<Harness />);

    // userEvent's click focuses the button, replicating real browser behavior
    // (this is what the dialog captures as the focus-restore target).
    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByLabelText("Image URL")).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
