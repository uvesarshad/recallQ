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

  // For /app/* the `authorized` callback in `lib/auth.config.ts` decides
  // whether to redirect unauthenticated requests to /login. Returning
  // undefined lets that default behavior run.
  return undefined;
});

export const config = {
  matcher: ["/app/:path*", "/api/v1/:path*"],
};
