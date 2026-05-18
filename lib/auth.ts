import NextAuth from "next-auth";
import type { Session } from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { db, poolInstance } from "@/lib/db";
import { env } from "@/lib/env";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyPassword } from "@/lib/password";

function normalizeAuthUrlEnvironment() {
  if (process.env.AUTH_URL || process.env.NODE_ENV !== "development") {
    return;
  }

  const configuredUrl = env.NEXTAUTH_URL;
  if (!configuredUrl) {
    return;
  }

  try {
    const { hostname } = new URL(configuredUrl);
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    if (isLocalHost) {
      delete process.env.NEXTAUTH_URL;
      console.warn(
        "Ignoring local NEXTAUTH_URL in development so Auth.js can use the active dev server port. Set AUTH_URL to force a fixed auth origin.",
      );
    }
  } catch {
    delete process.env.NEXTAUTH_URL;
  }
}

normalizeAuthUrlEnvironment();

// Dev-only mock session
const devBypass = env.DEV_BYPASS_LOGIN === "true";
const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_USER_EMAIL = "dev@example.com";
const DEV_USER = {
  id: DEV_USER_ID,
  name: "Dev User",
  email: DEV_USER_EMAIL,
};

const devSession: Session = {
  user: DEV_USER,
  expires: "9999-12-31T23:59:59.999Z",
};

async function ensureDevUser() {
  if (!devBypass) return;

  await db.query(
    `INSERT INTO users (id, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name, email = EXCLUDED.email`,
    [DEV_USER_ID, DEV_USER.name, DEV_USER_EMAIL],
  );
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        const result = await db.query<{
          id: string;
          name: string | null;
          email: string;
          image: string | null;
          password_hash: string | null;
        }>(
          `SELECT id, name, email, image, password_hash
           FROM users
           WHERE lower(email) = lower($1)
           LIMIT 1`,
          [email],
        );
        const user = result.rows[0];

        if (!user || !verifyPassword(password, user.password_hash)) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  adapter: devBypass ? undefined : PostgresAdapter(poolInstance),
  secret: env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token, user }) {
      if (devBypass) {
        await ensureDevUser();
        return { ...session, ...devSession };
      }
      
      // Map the user ID correctly from the database user or the JWT token
      if (session.user) {
        const userId = user?.id || token?.sub;
        if (userId) {
          session.user.id = userId;
        }
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut, auth: baseAuth } = nextAuth;

export async function auth(): Promise<Session | null> {
  if (devBypass) {
    await ensureDevUser();
    return devSession;
  }

  try {
    return await baseAuth();
  } catch (error) {
    console.error("Internal Auth error:", error);
    return null;
  }
}
