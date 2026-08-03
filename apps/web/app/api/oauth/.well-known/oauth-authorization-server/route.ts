import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET() {
  return NextResponse.json({
    issuer: APP_URL,
    authorization_endpoint: `${APP_URL}/api/oauth/authorize`,
    token_endpoint: `${APP_URL}/api/oauth/token`,
    revocation_endpoint: `${APP_URL}/api/oauth/revoke`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
  });
}
