import { NextRequest, NextResponse } from "next/server";
import { getInstallationByUserAndId } from "@/lib/db/installations";
import { listInstallationRepositories } from "@/lib/github/repos";
import { getServerSession } from "@/lib/session/get-server-session";

function parseInstallationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const installationId = parseInstallationId(searchParams.get("installation_id"));
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  const installation = await getInstallationByUserAndId(session.user.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found" }, { status: 403 });
  }

  const query = searchParams.get("query")?.trim() || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const repos = await listInstallationRepositories({
      installationId,
      owner: installation.accountLogin,
      query,
      limit: typeof limit === "number" && Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json(repos);
  } catch (error) {
    console.error("Failed to fetch installation repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
