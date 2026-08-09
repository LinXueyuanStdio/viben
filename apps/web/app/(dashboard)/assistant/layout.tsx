import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "@/lib/session/get-server-session";
import {
  getArchivedSessionCountByUserId,
  getSessionsWithUnreadByUserId,
} from "@/lib/db/sessions";
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

  const [sessions, archivedCount] = await Promise.all([
    getSessionsWithUnreadByUserId(session.user.id, { status: "active" }),
    getArchivedSessionCountByUserId(session.user.id),
  ]);

  return (
    <SessionsRouteShell
      currentUser={session.user}
      initialSessionsData={{ sessions, archivedCount }}
    >
      {children}
    </SessionsRouteShell>
  );
}
