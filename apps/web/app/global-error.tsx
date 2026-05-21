"use client";

// Last-resort boundary that fires when the root layout itself errors. Cannot
// rely on AppShell, tailwind classes the layout would have configured, or the
// fonts — so the markup is intentionally minimal and inline-styled.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            padding: 32,
            borderRadius: 12,
            background: "#171717",
            border: "1px solid #262626",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#a3a3a3", marginTop: 8 }}>
            We hit an unexpected error before the page could load. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#ffffff",
              background: "#6366f1",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 11, color: "#737373" }}>
              Error ID: <span style={{ fontFamily: "ui-monospace, monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
