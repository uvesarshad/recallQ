import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-text-primary sm:text-7xl font-sans">
        Recall
      </h1>
      <p className="mt-6 text-lg leading-8 text-text-mid max-w-lg">
        Frictionless capture + intelligent organisation + visual recall tool.
        Save anything from anywhere.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          href="/app"
          className="rounded-buttons bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Go to App
        </Link>
        <Link href="/app/login" className="text-sm font-semibold leading-6 text-text-primary">
          Sign In <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
