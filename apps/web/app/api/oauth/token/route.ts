import { NextRequest, NextResponse } from "next/server";
import { consumeAuthorizationCode, issueTokens, rotateRefreshToken } from "@/lib/auth/oauth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData().catch(() => request.json().catch(() => null));
    if (!body) {
      return NextResponse.json({ error: "invalid_request", error_description: "Could not parse request body" }, { status: 400 });
    }

    const get = (key: string) => {
      const v = body instanceof FormData ? body.get(key) : body[key];
      return typeof v === "string" ? v : undefined;
    };
    const grantType = get("grant_type");

    // ── authorization_code ──
    if (grantType === "authorization_code") {
      const code = get("code");
      const codeVerifier = get("code_verifier");
      const redirectUri = get("redirect_uri");

      if (!code) {
        return NextResponse.json({ error: "invalid_request", error_description: "code is required" }, { status: 400 });
      }

      const grant = await consumeAuthorizationCode(code, codeVerifier);
      if (!grant) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, { status: 400 });
      }

      const tokens = await issueTokens(grant.userId, grant.clientId, grant.scopes);

      return NextResponse.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        scope: tokens.scopes,
      });
    }

    // ── refresh_token ──
    if (grantType === "refresh_token") {
      const refreshToken = get("refresh_token");
      if (!refreshToken) {
        return NextResponse.json({ error: "invalid_request", error_description: "refresh_token is required" }, { status: 400 });
      }

      const tokens = await rotateRefreshToken(refreshToken);
      if (!tokens) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" }, { status: 400 });
      }

      return NextResponse.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        scope: tokens.scopes,
      });
    }

    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (error) {
    console.error("[oauth] token error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
