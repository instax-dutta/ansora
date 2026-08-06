"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest server-side only — never render stack traces to visitors.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="font-serif text-7xl font-semibold text-brand">500</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          An unexpected error occurred. If this keeps happening, check the
          server logs — visitors never see stack traces here.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
