import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var theme=localStorage.getItem("recall-theme");if(theme){document.documentElement.dataset.theme=JSON.parse(theme)}}catch(e){}`,
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
