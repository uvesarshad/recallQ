import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import PWASetup from "@/components/PWASetup";

export const metadata: Metadata = {
  title: "Recall - Save anything. Find everything.",
  description: "Frictionless capture + intelligent organisation + visual recall tool.",
  manifest: "/manifest.json",
  applicationName: "Recall",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Recall",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce injected by apps/web/proxy.ts so the inline theme script (and
  // every Next.js hydration script) survives a CSP without 'unsafe-inline'.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{var raw=localStorage.getItem("recall-theme");var d=location.pathname==="/"?"light":"dark";var t=raw?JSON.parse(raw):d;if(t!=="dark"&&t!=="light"&&t!=="system")t=d;var m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=t==="system"?(m?"dark":"light"):t}catch(e){document.documentElement.dataset.theme=location.pathname==="/"?"light":"dark"}`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <PWASetup />
        {children}
      </body>
    </html>
  );
}
