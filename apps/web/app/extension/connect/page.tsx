import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-tokens";
import { logger } from "@/lib/logger";

// Auth bridge between the Chrome extension (and, later, the mobile app) and
// the web NextAuth session. The extension drives this via
// `chrome.identity.launchWebAuthFlow`, which:
//   1. Opens this URL with `return_url=https://<ext-id>.chromiumapp.org/...`
//   2. Lets the user sign in to the web app if they aren't already
//   3. Captures the redirect when this page mints a token and bounces back
//   4. Hands the token to the extension popup as the URL fragment / query
//
// Open-redirect prevention: we only honour return_urls under the
// chromiumapp.org host (Chrome's reserved redirect domain for extensions)
// plus the localhost fallback used by `web-ext` during dev.

export const dynamic = "force-dynamic";

const ALLOWED_RETURN_HOSTS = ["chromiumapp.org", "localhost"];

function isAllowedReturnUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.protocol === "http:" && url.hostname !== "localhost") return false;
    return ALLOWED_RETURN_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

async function issueAndRedirect(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/extension/connect");
  }

  const returnUrl = String(formData.get("return_url") ?? "");
  const deviceName = String(formData.get("device_name") ?? "Chrome").slice(0, 64) || "Chrome";

  if (!isAllowedReturnUrl(returnUrl)) {
    redirect("/extension/connect?error=invalid_return_url");
  }

  const generated = generateToken();
  await db.query(
    `INSERT INTO personal_access_tokens (user_id, device_name, token_hash, prefix)
     VALUES ($1, $2, $3, $4)`,
    [session.user.id, deviceName, generated.hash, generated.prefix],
  );

  logger.info("extension-connect", "Issued device token", {
    user_id: session.user.id,
    device_name: deviceName,
    prefix: generated.prefix,
  });

  const callbackUrl = new URL(returnUrl);
  callbackUrl.searchParams.set("token", generated.raw);
  callbackUrl.searchParams.set("prefix", generated.prefix);
  callbackUrl.searchParams.set("device_name", deviceName);
  redirect(callbackUrl.toString());
}

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams?: Promise<{ return_url?: string; error?: string; device_name?: string }>;
}) {
  const session = await auth();
  const params = (await searchParams) ?? {};
  const returnUrl = params.return_url ?? "";
  const error = params.error;
  const deviceName = params.device_name?.slice(0, 64) || "Chrome";

  if (!session?.user?.id) {
    const next = `/extension/connect${returnUrl ? `?return_url=${encodeURIComponent(returnUrl)}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(next)}`);
  }

  const validReturnUrl = returnUrl ? isAllowedReturnUrl(returnUrl) : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md rounded-modals border border-border bg-surface p-8 shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">RecallQ</p>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">Connect this device</h1>
        <p className="mt-2 text-sm text-text-muted">
          You&apos;re signed in as <strong className="text-text-primary">{session.user.email}</strong>. Approve the connection to let the {deviceName} extension save links and notes into your archive on your behalf.
        </p>

        {error === "invalid_return_url" ? (
          <div className="mt-5 rounded-buttons border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            That redirect URL isn&apos;t allowed. Re-open the extension and click Sign in again — it should attach a valid return URL automatically.
          </div>
        ) : null}

        {!validReturnUrl && !error ? (
          <div className="mt-5 rounded-buttons border border-border bg-bg px-4 py-3 text-sm text-text-mid">
            This page is launched by the RecallQ Chrome extension. Open it from the extension popup instead of directly.
          </div>
        ) : null}

        {validReturnUrl ? (
          <form action={issueAndRedirect} className="mt-6 space-y-3">
            <input type="hidden" name="return_url" value={returnUrl} />
            <input type="hidden" name="device_name" value={deviceName} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Connect {deviceName}
            </button>
            <p className="text-center text-[11px] text-text-muted">
              You can revoke this device at any time from Settings → Connected devices.
            </p>
          </form>
        ) : null}
      </div>
    </main>
  );
}
