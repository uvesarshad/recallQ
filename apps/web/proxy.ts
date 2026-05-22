import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./lib/auth.config";

const { auth } = NextAuth(authConfig);

// CORS for /api/v1/*. The Chrome extension (Stage 8) calls these endpoints
// from `chrome-extension://<id>` origins, and the future mobile app sends
// no Origin header at all. We respond permissively because the API is
// bearer-token-gated (no cookies travel cross-origin), so allowing `*` is
// safe — there's nothing a malicious site can exfiltrate without already
// possessing a valid token.
//
// `Vary: Origin` keeps caches from serving cross-origin responses to
// same-origin callers and vice versa.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, X-Internal-Ingest-Token, X-Recall-User-Id",
  "Access-Control-Expose-Headers": "Retry-After",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
} as const;

const IS_PROD = process.env.NODE_ENV === "production";

// Per-request CSP nonce so we can drop `'unsafe-inline'` from `script-src`.
// `'strict-dynamic'` makes the browser trust any script the nonced script
// loads transitively — that's what lets the Razorpay checkout shim
// (`document.createElement('script')`) keep working without listing every
// host explicitly. The nonce flows into the root layout via the `x-nonce`
// request header so `next/script` and `next/document` attach it to inline
// scripts.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "connect-src 'self' https://api.razorpay.com https://generativelanguage.googleapis.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// NOTE on the script-src list: when `'strict-dynamic'` is honored by a
// browser, it ignores host allowlists and `'unsafe-inline'` — only the
// nonced script (and what it loads) executes. We keep `'unsafe-inline'` +
// `https:` as a fallback for older browsers that don't understand
// `'strict-dynamic'`; those browsers fall through and get the legacy
// behavior. Modern browsers get the strict policy.

function generateNonce(): string {
  // Web Crypto is available in the Edge runtime.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/v1/")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // HTML routes: attach a per-request CSP nonce. Stay in Report-Only mode
  // until we've observed clean reports in production for a couple of weeks;
  // the next P2 item is to flip the header name to enforcing.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(
    IS_PROD ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy-Report-Only",
    csp,
  );
  return response;
});

export const config = {
  // Exclude static assets and the service worker so we don't pay middleware
  // cost on every chunk fetch. Everything else (including `/`, `/login`,
  // `/app/*`, and `/api/v1/*`) goes through the middleware.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-).*)"],
};
