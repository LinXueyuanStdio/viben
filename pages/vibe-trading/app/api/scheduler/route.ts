import { recoverRunningSchedulers, getSchedulerStatus } from "@/lib/scheduler";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSchedulerStatus();
  return NextResponse.json({ active: status });
}

export async function POST() {
  const started = await recoverRunningSchedulers();
  const status = getSchedulerStatus();
  return NextResponse.json({ recovered: started, active: status });
}
