"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCw } from "lucide-react";

// Boundary for any rendering error inside the authenticated app shell. The
// AppShell layout (sidebar, header, mobile nav) stays mounted; this just
// replaces the page body, so the user can still navigate elsewhere.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-boundary]", error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10">
          <AlertCircle className="h-5 w-5 text-rose-300" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-sm text-text-muted">
          The page hit an unexpected error. You can try again or head back to your feed — your data is safe.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-4 py-2 text-sm text-text-mid hover:text-text-primary"
          >
            Back to feed
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-4 text-[10px] text-text-muted">
            Error ID: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
