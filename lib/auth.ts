import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db, poolInstance } from "@/lib/db";
import { env } from "@/lib/env";

// Dev-only mock session
const devBypass = env.DEV_BYPASS_LOGIN === "true";
const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_USER_EMAIL = "dev@example.com";

const devSession = {
  user: {
    id: DEV_USER_ID,
    name: "Dev User",
    email: DEV_USER_EMAIL,
  },
  expires: "9999-12-31T23:59:59.999Z",
};

async function ensureDevUser() {
  if (!devBypass) return;

  await db.query(
    `INSERT INTO users (id, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name, email = EXCLUDED.email`,
    [DEV_USER_ID, devSession.user.name, DEV_USER_EMAIL],
  );
}

const nextAuth = NextAuth({
  adapter: devBypass ? undefined : PostgresAdapter(poolInstance),
  secret: env.AUTH_SECRET,
  providers: devBypass
    ? []
    : [
        Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
        Resend({
          from: `Recall <no-reply@${env.APP_DOMAIN}>`,
        }),
      ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (devBypass) return true; // Always authorized in dev bypass mode

      const isLoggedIn = !!auth?.user;
      const isProtectedAppPath = nextUrl.pathname === "/app" || nextUrl.pathname.startsWith("/app/");
      const isAppAuthPath = nextUrl.pathname === "/app/login";

      if (isAppAuthPath) {
        return true;
      }

      if (isProtectedAppPath) {
        return isLoggedIn;
      }

      return true;
    },
    async session({ session, user, token }) {
      if (devBypass) {
        await ensureDevUser();
        return { ...session, ...devSession };
      }
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt", // Use JWT for devBypass, otherwise adapter requires 'database'
  },
  pages: {
    signIn: "/app/login",
  },
});

export const { handlers, signIn, signOut } = nextAuth;

export async function auth(...args: any[]) {
  if (devBypass && args.length === 0) {
    await ensureDevUser();
    return devSession;
  }

  if (args.length === 0) {
    return (nextAuth.auth as any)();
  }

  return (nextAuth.auth as any)(...args);
}
