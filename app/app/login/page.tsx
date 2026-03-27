import { signIn, auth } from "@/lib/auth";
import { Mail } from "lucide-react";
import { redirect } from "next/navigation";

function getSafeRedirectTarget(target?: string) {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/app";
  }

  return target;
}

export default async function AppLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; callbackUrl?: string }>;
}) {
  if (process.env.DEV_BYPASS_LOGIN === "true") {
    redirect("/app");
  }

  const session = await auth();
  if (session?.user?.id) {
    redirect("/app");
  }

  const params = await searchParams;
  const redirectTo = getSafeRedirectTarget(params?.callbackUrl ?? params?.next);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[400px] rounded-modals border border-border bg-surface p-8 shadow-lg">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-text-primary">Recall</h1>
            <p className="mt-2 text-sm text-text-mid">Sign in to open your private workspace.</p>
          </div>

          <div className="space-y-4">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-buttons bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-100"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4" />
                Continue with Google
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border-soft" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-text-muted">Or magic link</span>
              </div>
            </div>

            <form
              action={async (formData) => {
                "use server";
                const email = formData.get("email") as string;
                await signIn("resend", { email, redirectTo });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-glow"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                <Mail className="h-4 w-4" />
                Sign in with Email
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-text-muted">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
