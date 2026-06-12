import { useState, useCallback, useMemo } from "react";
import {
  KeyRound,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Bug,
  Play,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface InspectorAuthProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface AuthToken {
  id: string;
  name: string;
  type: "bearer" | "api_key" | "oauth";
  value: string;
  createdAt: Date;
  expiresAt?: Date;
  scopes?: string[];
}

// OAuth 2.0 configuration
interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}

// PKCE parameters
interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

// OAuth flow status
type OAuthFlowStatus =
  | "idle"
  | "generating_pkce"
  | "awaiting_authorization"
  | "exchanging_code"
  | "success"
  | "error";

// Debug log entry
interface DebugLogEntry {
  timestamp: Date;
  step: string;
  type: "request" | "response" | "info" | "error";
  data: unknown;
}

/**
 * Generate a cryptographically random string for PKCE code_verifier
 * RFC 7636 recommends 43-128 characters
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code_challenge from code_verifier using SHA-256
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64url encode (RFC 4648 Section 5)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build OAuth authorization URL with optional PKCE parameters
 */
function buildAuthorizationUrl(
  config: OAuthConfig,
  state: string,
  pkce?: PKCEParams
): string {
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  if (config.scopes.trim()) {
    url.searchParams.set("scope", config.scopes.trim());
  }

  if (pkce) {
    url.searchParams.set("code_challenge", pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
  }

  return url.toString();
}

export function InspectorAuth({ makeRequest, enabled = true }: InspectorAuthProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenType, setNewTokenType] = useState<"bearer" | "api_key">("bearer");
  const [newTokenValue, setNewTokenValue] = useState("");

  // OAuth state
  const [oauthExpanded, setOauthExpanded] = useState(false);
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig>({
    authorizationUrl: "",
    tokenUrl: "",
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:3000/callback",
    scopes: "",
  });
  const [usePKCE, setUsePKCE] = useState(true);
  const [pkceParams, setPkceParams] = useState<PKCEParams | null>(null);
  // Store OAuth state for CSRF validation (used when verifying callback)
  const [_oauthState, setOauthState] = useState<string>("");
  const [flowStatus, setFlowStatus] = useState<OAuthFlowStatus>("idle");
  const [flowError, setFlowError] = useState<string | null>(null);
  const [authorizationCode, setAuthorizationCode] = useState("");

  // Debug mode
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [debugExpanded, setDebugExpanded] = useState(true);

  // Add debug log entry
  const addDebugLog = useCallback(
    (step: string, type: DebugLogEntry["type"], data: unknown) => {
      if (debugMode) {
        setDebugLogs((prev) => [
          ...prev,
          { timestamp: new Date(), step, type, data },
        ]);
      }
    },
    [debugMode]
  );

  // Clear debug logs
  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  // Validate OAuth config
  const isOAuthConfigValid = useMemo(() => {
    return (
      oauthConfig.authorizationUrl.trim() !== "" &&
      oauthConfig.tokenUrl.trim() !== "" &&
      oauthConfig.clientId.trim() !== "" &&
      oauthConfig.redirectUri.trim() !== ""
    );
  }, [oauthConfig]);

  // Start OAuth flow
  const startOAuthFlow = useCallback(async () => {
    if (!isOAuthConfigValid) return;

    setFlowStatus("generating_pkce");
    setFlowError(null);
    clearDebugLogs();

    try {
      // Generate state parameter for CSRF protection
      const stateArray = new Uint8Array(16);
      crypto.getRandomValues(stateArray);
      const state = base64UrlEncode(stateArray);
      setOauthState(state);

      addDebugLog("Generate State", "info", { state });

      let pkce: PKCEParams | undefined;

      // Generate PKCE parameters if enabled
      if (usePKCE) {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        pkce = {
          codeVerifier,
          codeChallenge,
          codeChallengeMethod: "S256",
        };
        setPkceParams(pkce);

        addDebugLog("Generate PKCE", "info", {
          codeVerifier,
          codeChallenge,
          codeChallengeMethod: "S256",
        });
      } else {
        setPkceParams(null);
      }

      // Build authorization URL
      const authUrl = buildAuthorizationUrl(oauthConfig, state, pkce);

      addDebugLog("Build Authorization URL", "request", {
        url: authUrl,
        params: {
          response_type: "code",
          client_id: oauthConfig.clientId,
          redirect_uri: oauthConfig.redirectUri,
          state,
          scope: oauthConfig.scopes || undefined,
          code_challenge: pkce?.codeChallenge,
          code_challenge_method: pkce?.codeChallengeMethod,
        },
      });

      setFlowStatus("awaiting_authorization");

      // Open authorization URL in a new window
      window.open(authUrl, "_blank", "width=600,height=700");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("inspector.unknownErrorOccurred");
      setFlowError(errorMessage);
      setFlowStatus("error");
      addDebugLog("Error", "error", { message: errorMessage });
    }
  }, [isOAuthConfigValid, oauthConfig, usePKCE, addDebugLog, clearDebugLogs, t]);

  // Exchange authorization code for tokens
  const exchangeCodeForToken = useCallback(async () => {
    if (!authorizationCode.trim()) return;

    setFlowStatus("exchanging_code");
    setFlowError(null);

    try {
      // Build token request body
      const tokenParams = new URLSearchParams();
      tokenParams.set("grant_type", "authorization_code");
      tokenParams.set("code", authorizationCode.trim());
      tokenParams.set("redirect_uri", oauthConfig.redirectUri);
      tokenParams.set("client_id", oauthConfig.clientId);

      if (oauthConfig.clientSecret.trim()) {
        tokenParams.set("client_secret", oauthConfig.clientSecret);
      }

      if (usePKCE && pkceParams) {
        tokenParams.set("code_verifier", pkceParams.codeVerifier);
      }

      addDebugLog("Token Request", "request", {
        url: oauthConfig.tokenUrl,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: Object.fromEntries(tokenParams.entries()),
      });

      // Make token request
      const response = await fetch(oauthConfig.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });

      const responseData = await response.json();

      addDebugLog("Token Response", "response", {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      });

      if (!response.ok) {
        throw new Error(
          responseData.error_description ||
            responseData.error ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Extract access token
      const accessToken = responseData.access_token;
      const tokenType = responseData.token_type || "Bearer";
      const expiresIn = responseData.expires_in;
      const scope = responseData.scope;

      if (!accessToken) {
        throw new Error("No access_token in response");
      }

      // Create new token entry
      const newToken: AuthToken = {
        id: `oauth-${Date.now()}`,
        name: `OAuth Token (${oauthConfig.clientId.slice(0, 8)}...)`,
        type: "oauth",
        value: accessToken,
        createdAt: new Date(),
        expiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : undefined,
        scopes: scope ? scope.split(" ") : undefined,
      };

      setTokens((prev) => [...prev, newToken]);
      setFlowStatus("success");
      setAuthorizationCode("");

      addDebugLog("Token Stored", "info", {
        tokenId: newToken.id,
        tokenType,
        expiresIn,
        scopes: newToken.scopes,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("inspector.unknownErrorOccurred");
      setFlowError(errorMessage);
      setFlowStatus("error");
      addDebugLog("Error", "error", { message: errorMessage });
    }
  }, [
    authorizationCode,
    oauthConfig,
    usePKCE,
    pkceParams,
    addDebugLog,
    t,
  ]);

  // Reset OAuth flow
  const resetOAuthFlow = useCallback(() => {
    setFlowStatus("idle");
    setFlowError(null);
    setPkceParams(null);
    setOauthState("");
    setAuthorizationCode("");
    clearDebugLogs();
  }, [clearDebugLogs]);

  const fetchTokens = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      // Note: Most MCP servers don't expose auth listing
      // This is primarily for servers that support token management
      const response = await makeRequest<{ tokens: AuthToken[] }>("auth/list", {});
      setTokens(response.tokens || []);
    } catch (e) {
      // Expected - most MCP servers don't support auth listing
      console.debug("[InspectorAuth] auth/list not supported:", e);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const addToken = () => {
    if (!newTokenName.trim() || !newTokenValue.trim()) return;

    const newToken: AuthToken = {
      id: `token-${Date.now()}`,
      name: newTokenName.trim(),
      type: newTokenType,
      value: newTokenValue,
      createdAt: new Date(),
    };

    setTokens((prev) => [...prev, newToken]);
    setNewTokenName("");
    setNewTokenValue("");
  };

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const copyToken = async (token: AuthToken) => {
    await navigator.clipboard.writeText(token.value);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const maskToken = (value: string) => {
    if (value.length <= 8) return "********";
    return value.substring(0, 4) + "********" + value.substring(value.length - 4);
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "bearer":
        return "bg-blue-500/10 text-blue-600";
      case "api_key":
        return "bg-green-500/10 text-green-600";
      case "oauth":
        return "bg-purple-500/10 text-purple-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const getFlowStatusDisplay = () => {
    switch (flowStatus) {
      case "idle":
        return null;
      case "generating_pkce":
        return {
          icon: Loader2,
          text: t("inspector.generatingPKCE"),
          color: "text-blue-500",
          animate: true,
        };
      case "awaiting_authorization":
        return {
          icon: ExternalLink,
          text: t("inspector.awaitingAuth"),
          color: "text-yellow-500",
          animate: false,
        };
      case "exchanging_code":
        return {
          icon: Loader2,
          text: t("inspector.exchangingCode"),
          color: "text-blue-500",
          animate: true,
        };
      case "success":
        return {
          icon: Check,
          text: t("inspector.oauthSuccess"),
          color: "text-green-500",
          animate: false,
        };
      case "error":
        return {
          icon: AlertTriangle,
          text: flowError || t("inspector.oauthError"),
          color: "text-red-500",
          animate: false,
        };
      default:
        return null;
    }
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.authNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.authNotSupportedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Token List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border pr-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{t("inspector.auth")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{tokens.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchTokens} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <KeyRound className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.noTokens")}</p>
            </div>
          ) : (
            tokens.map((token) => (
              <div key={token.id} className="p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-sm font-medium flex-1 truncate">{token.name}</span>
                  <Badge className={`text-[10px] h-4 ${getTypeStyle(token.type)}`}>
                    {token.type}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 font-mono">
                    {showToken === token.id ? token.value : maskToken(token.value)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setShowToken(showToken === token.id ? null : token.id)}
                  >
                    {showToken === token.id ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToken(token)}
                  >
                    {copiedId === token.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500"
                    onClick={() => removeToken(token.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="text-[10px] text-muted-foreground">
                  {t("inspector.created")} {token.createdAt.toLocaleDateString()}
                  {token.expiresAt && ` | ${t("inspector.expires")} ${token.expiresAt.toLocaleDateString()}`}
                </div>

                {token.scopes && token.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {token.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-[10px] h-4">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Add Token Form & OAuth */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Manual Token Section */}
        <h3 className="text-sm font-medium mb-4">{t("inspector.addToken")}</h3>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("inspector.tokenName")}
            </label>
            <Input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder={t("inspector.myApiKeyPlaceholder")}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("inspector.tokenType")}
            </label>
            <select
              value={newTokenType}
              onChange={(e) => setNewTokenType(e.target.value as "bearer" | "api_key")}
              className="flex 8-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="bearer">{t("inspector.bearerTokenOption")}</option>
              <option value="api_key">{t("inspector.apiKeyOption")}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("inspector.tokenValue")}
            </label>
            <Input
              type="password"
              value={newTokenValue}
              onChange={(e) => setNewTokenValue(e.target.value)}
              placeholder={t("inspector.tokenPlaceholder")}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={addToken}
            disabled={!newTokenName.trim() || !newTokenValue.trim()}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("inspector.addToken")}
          </Button>
        </div>

        {/* OAuth 2.0 Section */}
        <div className="mt-8">
          <Collapsible open={oauthExpanded} onOpenChange={setOauthExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-4">
              {oauthExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Lock className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">
                {t("inspector.oauthConfig")}
              </span>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {usePKCE ? t("inspector.authModes.pkce") : t("inspector.authModes.standard")}
              </Badge>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 max-w-md">
              {/* Authorization URL */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.authorizationUrl")}
                  <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Input
                  value={oauthConfig.authorizationUrl}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      authorizationUrl: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.oauthAuthorizeUrl")}
                  className="text-sm font-mono"
                />
              </div>

              {/* Token URL */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.tokenUrl")}
                  <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Input
                  value={oauthConfig.tokenUrl}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      tokenUrl: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.oauthTokenUrl")}
                  className="text-sm font-mono"
                />
              </div>

              {/* Client ID */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.clientId")}
                  <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Input
                  value={oauthConfig.clientId}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      clientId: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.clientId")}
                  className="text-sm font-mono"
                />
              </div>

              {/* Client Secret (optional) */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.clientSecret")}
                  <span className="text-muted-foreground/50 ml-1 text-[10px]">
                    ({t("common.optional")})
                  </span>
                </Label>
                <Input
                  type="password"
                  value={oauthConfig.clientSecret}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      clientSecret: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.clientSecret")}
                  className="text-sm font-mono"
                />
              </div>

              {/* Redirect URI */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.redirectUri")}
                  <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Input
                  value={oauthConfig.redirectUri}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      redirectUri: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.redirectUri")}
                  className="text-sm font-mono"
                />
              </div>

              {/* Scopes */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("inspector.scopes")}
                  <span className="text-muted-foreground/50 ml-1 text-[10px]">
                    ({t("inspector.spaceSeparated")})
                  </span>
                </Label>
                <Input
                  value={oauthConfig.scopes}
                  onChange={(e) =>
                    setOauthConfig((prev) => ({
                      ...prev,
                      scopes: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.oauthScope")}
                  className="text-sm font-mono"
                />
              </div>

              {/* PKCE Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-pkce"
                  checked={usePKCE}
                  onCheckedChange={(checked) => setUsePKCE(checked === true)}
                />
                <Label
                  htmlFor="use-pkce"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t("inspector.usePKCE")}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({t("inspector.recommended")})
                  </span>
                </Label>
              </div>

              {/* Debug Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={(checked) => setDebugMode(checked === true)}
                />
                <Label
                  htmlFor="debug-mode"
                  className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Bug className="h-3.5 w-3.5" />
                  {t("inspector.debugMode")}
                </Label>
              </div>

              {/* Flow Status Indicator */}
              {getFlowStatusDisplay() && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border",
                    flowStatus === "error"
                      ? "bg-red-500/10 border-red-500/30"
                      : flowStatus === "success"
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                  )}
                >
                  {(() => {
                    const display = getFlowStatusDisplay();
                    if (!display) return null;
                    const Icon = display.icon;
                    return (
                      <>
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            display.color,
                            display.animate && "animate-spin"
                          )}
                        />
                        <span className={cn("text-xs flex-1", display.color)}>
                          {display.text}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Authorization Code Input (when awaiting) */}
              {flowStatus === "awaiting_authorization" && (
                <div className="space-y-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-xs text-muted-foreground">
                    {t("inspector.enterAuthCode")}
                  </p>
                  <Input
                    value={authorizationCode}
                    onChange={(e) => setAuthorizationCode(e.target.value)}
                    placeholder={t("inspector.authCodePlaceholder")}
                    className="text-sm font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={exchangeCodeForToken}
                      disabled={!authorizationCode.trim()}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {t("inspector.exchangeCode")}
                    </Button>
                    <Button variant="outline" onClick={resetOAuthFlow}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Start OAuth Flow Button */}
              {(flowStatus === "idle" ||
                flowStatus === "success" ||
                flowStatus === "error") && (
                <div className="flex gap-2">
                  <Button
                    onClick={startOAuthFlow}
                    disabled={!isOAuthConfigValid}
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("inspector.startOAuthFlow")}
                  </Button>
                  {flowStatus !== "idle" && (
                    <Button variant="outline" onClick={resetOAuthFlow}>
                      {t("common.reset")}
                    </Button>
                  )}
                </div>
              )}

              {/* PKCE Parameters Display (debug) */}
              {debugMode && pkceParams && (
                <Collapsible open={debugExpanded} onOpenChange={setDebugExpanded}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                    {debugExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("inspector.pkceParams")}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="p-2 rounded bg-muted/50 text-xs font-mono space-y-1">
                      <div>
                        <span className="text-muted-foreground">code_verifier: </span>
                        <span className="break-all">{pkceParams.codeVerifier}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">code_challenge: </span>
                        <span className="break-all">{pkceParams.codeChallenge}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">method: </span>
                        <span>{pkceParams.codeChallengeMethod}</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Debug Logs */}
              {debugMode && debugLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("inspector.debugLogs")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={clearDebugLogs}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-auto space-y-2">
                    {debugLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-2 rounded border text-xs",
                          log.type === "error"
                            ? "bg-red-500/10 border-red-500/30"
                            : log.type === "request"
                              ? "bg-blue-500/10 border-blue-500/30"
                              : log.type === "response"
                                ? "bg-green-500/10 border-green-500/30"
                                : "bg-muted/50 border-border"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4",
                              log.type === "error"
                                ? "border-red-500/50 text-red-600"
                                : log.type === "request"
                                  ? "border-blue-500/50 text-blue-600"
                                  : log.type === "response"
                                    ? "border-green-500/50 text-green-600"
                                    : "border-border"
                            )}
                          >
                            {log.type.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{log.step}</span>
                          <span className="text-muted-foreground ml-auto text-[10px]">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 max-w-md">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                {t("inspector.aboutAuth")}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("inspector.aboutAuthDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
