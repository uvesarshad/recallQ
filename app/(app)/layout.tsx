import AppShell from "@/components/AppShell";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    console.error("Auth error in app layout:", error);
    session = null;
  }

  if (!session) {
    redirect("/app/login");
  }
  const user = {
    id: session.user?.id,
    name: session.user?.name,
    email: session.user?.email,
    image: session.user && "image" in session.user ? (session.user.image as string | null | undefined) : undefined,
  };

  return (
    <AppShell user={user}>{children}</AppShell>
  );
}
