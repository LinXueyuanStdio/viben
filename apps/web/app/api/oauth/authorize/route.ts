import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/middleware";
import { createAuthorizationCode } from "@/lib/auth/oauth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function consentPage(params: Record<string, string>, error?: string): NextResponse {
  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = params;
  const scopes = (scope || "read write").split(" ");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>授权 — Viben</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:hsl(0 0% 96%);color:hsl(0 0% 20%);display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:32px;max-width:420px;width:100%;margin:16px}
h1{font-size:20px;margin-bottom:8px}
p.sub{color:#666;font-size:14px;margin-bottom:24px}
.scopes{margin-bottom:24px}
.scope{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:8px;font-size:14px}
.scope .icon{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px}
.scope .icon.read{background:#e8f5e9;color:#2e7d32}.scope .icon.write{background:#fff3e0;color:#e65100}
.actions{display:flex;gap:12px}
.btn{flex:1;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;text-align:center;text-decoration:none}
.btn-allow{background:#18181b;color:#fff}.btn-allow:hover{background:#27272a}
.btn-deny{background:#f4f4f5;color:#52525b}.btn-deny:hover{background:#e4e4e7}
.error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:12px;border-radius:10px;margin-bottom:16px;font-size:13px}
.back{display:block;margin-top:12px;text-align:center;color:#999;font-size:13px}
</style>
</head>
<body>
<div class="card">
<h1>🔐 Viben 请求授权</h1>
<p class="sub">${client_id ? `应用 <strong>${client_id}</strong> 请求` : "应用请求"}访问你的 Viben 账户</p>
${error ? `<div class="error">${error}</div>` : ""}
<div class="scopes">
${scopes.map((s) => {
  const isWrite = s === "write";
  return `<div class="scope"><span class="icon ${s}">${isWrite ? "✎" : "👁"}</span><span>${isWrite ? "写入权限 — 创建和更新页面" : "读取权限 — 搜索和查看页面"}</span></div>`;
}).join("")}
</div>
<form method="POST">
<input type="hidden" name="client_id" value="${client_id || ""}">
<input type="hidden" name="redirect_uri" value="${redirect_uri || ""}">
<input type="hidden" name="state" value="${state || ""}">
<input type="hidden" name="scope" value="${scope || ""}">
<input type="hidden" name="code_challenge" value="${code_challenge || ""}">
<input type="hidden" name="code_challenge_method" value="${code_challenge_method || ""}">
<div class="actions">
<button type="submit" name="action" value="deny" class="btn btn-deny">拒绝</button>
<button type="submit" name="action" value="allow" class="btn btn-allow">允许</button>
</div>
</form>
<a href="${APP_URL}/login" class="back">切换账号</a>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = new URL(req.url);
  const loginUrl = new URL("/login", APP_URL);
  loginUrl.searchParams.set("redirect", url.pathname + url.search);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const session = await getOptionalSession(request);
  if (!session) return redirectToLogin(request);

  const sp = request.nextUrl.searchParams;
  const responseType = sp.get("response_type");
  if (responseType !== "code") {
    return NextResponse.json({ error: "unsupported_response_type" }, { status: 400 });
  }

  return consentPage(Object.fromEntries(sp.entries()));
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession(request);
  if (!session) return redirectToLogin(request);

  const body = await request.formData();
  const action = body.get("action");

  const redirectUri = (body.get("redirect_uri") as string) || "";
  const state = (body.get("state") as string) || "";

  // User denied
  if (action !== "allow") {
    const denyUrl = new URL(redirectUri || APP_URL);
    denyUrl.searchParams.set("error", "access_denied");
    if (state) denyUrl.searchParams.set("state", state);
    return NextResponse.redirect(denyUrl);
  }

  // Generate authorization code
  const codeChallenge = (body.get("code_challenge") as string) || undefined;
  const codeChallengeMethod = (body.get("code_challenge_method") as string) || undefined;
  const clientId = (body.get("client_id") as string) || undefined;
  const scope = (body.get("scope") as string) || "read write";

  try {
    const code = await createAuthorizationCode(
      session.userId,
      clientId,
      redirectUri || undefined,
      codeChallenge,
      codeChallengeMethod,
      scope,
    );

    const redirectUrl = new URL(redirectUri || APP_URL);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[oauth] authorize error:", error);
    const params: Record<string, string> = {};
    for (const [k, v] of body.entries()) params[k] = String(v);
    return consentPage(params, "授权失败，请重试。");
  }
}
