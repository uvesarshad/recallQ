import type { NextAuthConfig } from "next-auth";

import { env } from "@/lib/env";

export const authConfig = {
  secret: env.AUTH_SECRET,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const devBypass = env.DEV_BYPASS_LOGIN === "true";
      if (devBypass) return true;

      const isLoggedIn = !!auth?.user;
      const isProtectedAppPath = nextUrl.pathname === "/app" || nextUrl.pathname.startsWith("/app/");
      const isAuthPath = ["/login", "/signup", "/forgot-password", "/reset-password", "/app/login"].includes(
        nextUrl.pathname,
      );

      if (isAuthPath) {
        return true;
      }

      if (isProtectedAppPath) {
        return isLoggedIn;
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
