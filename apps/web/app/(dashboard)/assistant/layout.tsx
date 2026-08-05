import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "@/lib/session/get-server-session";
import { SessionsRouteShell } from "@/components/assistant/sessions-route-shell";

export default async function SessionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/");
  }

  return (
    <SessionsRouteShell currentUser={session.user}>
      {children}
    </SessionsRouteShell>
  );
}
