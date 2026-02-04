import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

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

export function InspectorAuth({ makeRequest, enabled = true }: InspectorAuthProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenType, setNewTokenType] = useState<"bearer" | "api_key">("bearer");
  const [newTokenValue, setNewTokenValue] = useState("");

  const fetchTokens = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      // Note: Most MCP servers don't expose auth listing
      // This is primarily for servers that support token management
      const response = await makeRequest<{ tokens: AuthToken[] }>("auth/list", {});
      setTokens(response.tokens || []);
    } catch {
      // Expected - auth listing often not supported
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
    if (value.length <= 8) return "••••••••";
    return value.substring(0, 4) + "••••••••" + value.substring(value.length - 4);
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
                  Created: {token.createdAt.toLocaleDateString()}
                  {token.expiresAt && ` • Expires: ${token.expiresAt.toLocaleDateString()}`}
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

      {/* Right Panel - Add Token Form */}
      <div className="flex-1 flex flex-col min-w-0">
        <h3 className="text-sm font-medium mb-4">{t("inspector.addToken")}</h3>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("inspector.tokenName")}
            </label>
            <Input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="My API Key"
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
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
              placeholder="sk-..."
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

        <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
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
