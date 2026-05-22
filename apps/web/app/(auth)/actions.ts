"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Resend } from "resend";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/password";

import { getSafeRedirectTarget } from "./utils";

const PASSWORD_MIN_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function redirectWithAuthError(pathname: string, error: string, redirectTo?: string): never {
  const params = new URLSearchParams({ error });
  if (redirectTo && redirectTo !== "/app") {
    params.set("callbackUrl", redirectTo);
  }

  redirect(`${pathname}?${params.toString()}`);
}

function normaliseEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getRequestBaseUrl() {
  if (env.APP_URL) return env.APP_URL;
  if (env.AUTH_URL) return env.AUTH_URL;
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "http://localhost:3000";

  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const from = env.RESEND_FROM_EMAIL ?? env.EMAIL_FROM;

  if (!env.RESEND_API_KEY || !from) {
    console.log(`Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from,
    to: email,
    subject: "Reset your Recall password",
    text: `Use this link to reset your Recall password. It expires in 1 hour:\n\n${resetUrl}`,
    html: `<p>Use this link to reset your Recall password. It expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

export async function signInWithGoogle(formData: FormData) {
  const redirectTo = getSafeRedirectTarget(formData.get("redirectTo"));
  await signIn("google", { redirectTo });
}

export async function signInWithApple(formData: FormData) {
  const redirectTo = getSafeRedirectTarget(formData.get("redirectTo"));
  await signIn("apple", { redirectTo });
}

export async function signInWithPassword(formData: FormData) {
  const redirectTo = getSafeRedirectTarget(formData.get("redirectTo"));
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      redirectWithAuthError("/login", error.type, redirectTo);
    }
    throw error;
  }
}

export async function createPasswordUser(formData: FormData) {
  const redirectTo = getSafeRedirectTarget(formData.get("redirectTo"));
  const name = String(formData.get("name") ?? "").trim();
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < PASSWORD_MIN_LENGTH) {
    redirectWithAuthError("/signup", "InvalidPassword", redirectTo);
  }

  const existing = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );

  if (existing.rowCount) {
    redirectWithAuthError("/signup", "AccountExists", redirectTo);
  }

  await db.query(
    `INSERT INTO users (name, email, "emailVerified", password_hash)
     VALUES ($1, $2, NOW(), $3)`,
    [name || null, email, hashPassword(password)],
  );

  await signIn("credentials", { email, password, redirectTo });
}

export async function requestPasswordReset(formData: FormData) {
  const email = normaliseEmail(formData.get("email"));

  if (email) {
    const user = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    const userId = user.rows[0]?.id;

    if (userId) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
      );

      const baseUrl = await getRequestBaseUrl();
      const resetUrl = new URL("/reset-password", baseUrl);
      resetUrl.searchParams.set("token", token);
      await sendPasswordResetEmail(email, resetUrl.toString());
    }
  }

  redirect("/forgot-password?status=sent");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    redirectWithAuthError("/reset-password", "InvalidToken");
  }

  if (password.length < PASSWORD_MIN_LENGTH || password !== confirmPassword) {
    const params = new URLSearchParams({ error: password !== confirmPassword ? "PasswordMismatch" : "InvalidPassword", token });
    redirect(`/reset-password?${params.toString()}`);
  }

  const tokenHash = hashResetToken(token);
  const resetToken = await db.query<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  const row = resetToken.rows[0];

  if (!row) {
    redirectWithAuthError("/reset-password", "InvalidToken");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           "emailVerified" = COALESCE("emailVerified", NOW())
       WHERE id = $2`,
      [hashPassword(password), row.user_id],
    );
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  redirect("/login?status=password-reset");
}
