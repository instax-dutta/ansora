// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortcutPanel } from "./ShortcutPanel";

describe("ShortcutPanel", () => {
  it("renders nothing when closed", () => {
    render(<ShortcutPanel open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("lists all seven shortcuts with the platform modifier and Esc hint", () => {
    render(<ShortcutPanel open onClose={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Keyboard shortcuts" });
    expect(region).toBeInTheDocument();

    for (const label of [
      "Bold",
      "Italic",
      "Link",
      "Insert image…",
      "Heading 2",
      "Bullet list",
      "Code block",
    ]) {
      expect(within(region).getByText(label)).toBeInTheDocument();
    }

    // jsdom's user agent isn't macOS, so the modifier chip is Ctrl.
    expect(within(region).getAllByText("Ctrl").length).toBe(7);
    expect(within(region).getByText("B")).toBeInTheDocument();
    expect(within(region).getByText("⇧K")).toBeInTheDocument();
    expect(within(region).getByText("⇧7")).toBeInTheDocument();
    expect(within(region).getByText("Esc")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutPanel open onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on an outside mousedown but not on an inside one", () => {
    const onClose = vi.fn();
    render(<ShortcutPanel open onClose={onClose} />);
    const region = screen.getByRole("region");

    fireEvent.mouseDown(within(region).getByText("Bold"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
