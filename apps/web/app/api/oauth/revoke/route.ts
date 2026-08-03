import { NextRequest, NextResponse } from "next/server";
import { revokeToken } from "@/lib/auth/oauth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData().catch(() => request.json().catch(() => null));
    if (!body) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const get = (key: string) => {
      const v = body instanceof FormData ? body.get(key) : body[key];
      return typeof v === "string" ? v : undefined;
    };

    const token = get("token");
    if (!token) {
      return NextResponse.json({ error: "invalid_request", error_description: "token is required" }, { status: 400 });
    }

    await revokeToken(token);
    return NextResponse.json({});
  } catch (error) {
    console.error("[oauth] revoke error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
