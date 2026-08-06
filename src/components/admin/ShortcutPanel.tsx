"use client";

/**
 * ShortcutPanel — the editor's keyboard-shortcut cheatsheet. A small popover
 * anchored under the toolbar; closes on ESC or outside click.
 *
 * Shortcuts only fire while the Markdown textarea is focused (see
 * PostEditor's keydown handler). ⌘ = Ctrl on Windows/Linux, shown accordingly.
 */
import { useEffect, useRef } from "react";

interface ShortcutPanelProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "B", label: "Bold" },
  { keys: "I", label: "Italic" },
  { keys: "K", label: "Link" },
  { keys: "⇧K", label: "Insert image…" },
  { keys: "⇧H", label: "Heading 2" },
  { keys: "⇧7", label: "Bullet list" },
  { keys: "⇧E", label: "Code block" },
];

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);

export function ShortcutPanel({ open, onClose }: ShortcutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const mod = IS_MAC ? "⌘" : "Ctrl";

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Keyboard shortcuts"
      className="animate-modal-in absolute right-4 top-12 z-30 w-60 rounded-xl border border-line bg-surface p-3 shadow-xl shadow-black/10"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Shortcuts
        </h2>
        <span className="text-[11px] text-ink-muted/70">in the editor</span>
      </div>
      <ul className="space-y-1">
        {SHORTCUTS.map((s) => (
          <li
            key={s.keys}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm text-ink transition-colors hover:bg-surface-soft"
          >
            <span>{s.label}</span>
            <span className="flex items-center gap-0.5">
              <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                {mod}
              </kbd>
              <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                {s.keys}
              </kbd>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-muted/80">
        Shortcuts work while the editor is focused. Press{" "}
        <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[10px] text-ink-muted">
          Esc
        </kbd>{" "}
        to close.
      </p>
    </div>
  );
}
