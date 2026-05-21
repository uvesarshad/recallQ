import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-text-muted">
          That URL doesn&apos;t exist (anymore). It might have been renamed or removed.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            Open your feed
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-4 py-2 text-sm text-text-mid hover:text-text-primary"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
