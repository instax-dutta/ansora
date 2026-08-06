"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/posts/new", label: "New post" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link
            href="/admin"
            className="mr-3 flex shrink-0 items-center gap-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand font-serif text-sm font-bold text-on-brand">
              A
            </span>
            <span className="hidden font-serif text-lg font-semibold text-ink sm:block">
              Admin
            </span>
          </Link>
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-muted hover:bg-surface-soft hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink sm:block"
          >
            View site
          </a>
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {loggingOut ? "…" : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
