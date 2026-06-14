import { listSessions } from "@/lib/session-store";
import { restoreSessionState } from "@/lib/state-machine";
import { NextResponse } from "next/server";

export async function GET() {
  const ids = await listSessions();
  const sessions = await Promise.all(
    ids.map(async (id) => {
      const state = await restoreSessionState(id);
      return {
        id,
        name: state.session_name,
        status: state.status,
        exchange: state.exchange,
        nav: state.metrics.nav,
        pnl_pct: state.metrics.total_pnl_pct,
        current_cycle: state.current_cycle,
      };
    })
  );
  return NextResponse.json({ sessions });
}
