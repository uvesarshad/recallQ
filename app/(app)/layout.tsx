import AppShell from "@/components/AppShell";
import PWASetup from "@/components/PWASetup";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) return null;
  const user = {
    id: session.user?.id,
    name: session.user?.name,
    email: session.user?.email,
    image: session.user && "image" in session.user ? (session.user.image as string | null | undefined) : undefined,
  };

  return (
    <>
      <PWASetup />
      <AppShell user={user}>{children}</AppShell>
    </>
  );
}
