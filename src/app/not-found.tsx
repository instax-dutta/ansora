import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="font-serif text-7xl font-semibold text-brand">404</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
          This page wandered off
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          The page you are looking for does not exist, was moved, or was
          never written. No stack traces were harmed in the making of this
          page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
