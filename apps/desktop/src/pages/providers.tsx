import { useState } from "react";
import {
  Check,
  X,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Globe,
  Lock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores";
import { useApiKeys } from "@/hooks/use-api-keys";
import type { Provider } from "@/types";

// Provider documentation URLs
const PROVIDER_DOCS: Record<string, string> = {
  sciencedirect: "https://dev.elsevier.com/",
  springer: "https://dev.springernature.com/",
  ieee: "https://developer.ieee.org/",
  scopus: "https://dev.elsevier.com/",
  semantic: "https://www.semanticscholar.org/product/api",
  core: "https://core.ac.uk/services/api",
};

export function ProvidersPage() {
  const { providers, setProviderApiKey } = useAppStore();

  const freeProviders = providers.filter((p) => p.category === "free");
  const apiKeyProviders = providers.filter((p) => p.category === "api_key");
  const institutionalProviders = providers.filter(
    (p) => p.category === "institutional"
  );

  const configuredCount = providers.filter(
    (p) => !p.requiresApiKey || p.hasApiKey
  ).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            {configuredCount} of {providers.length} sources available
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Configure API keys for providers that require them. Source selection is
        done per-server in the Search Service page.
      </p>

      {/* Free & Open Access */}
      <ProviderSection
        title="Free & Open Access"
        description="No registration required - available immediately"
        icon={<Globe className="h-5 w-5 text-green-600" />}
        providers={freeProviders}
      />

      {/* API Key Required */}
      <ProviderSection
        title="API Key Required"
        description="Register for a free API key to enable these sources"
        icon={<Key className="h-5 w-5 text-yellow-600" />}
        providers={apiKeyProviders}
        onApiKeyChange={setProviderApiKey}
        showApiKeyConfig
      />

      {/* Institutional Access */}
      <ProviderSection
        title="Institutional Access"
        description="Requires institutional subscription"
        icon={<Building2 className="h-5 w-5 text-blue-600" />}
        providers={institutionalProviders}
      />
    </div>
  );
}

interface ProviderSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  providers: Provider[];
  onApiKeyChange?: (id: string, hasKey: boolean) => void;
  showApiKeyConfig?: boolean;
}

function ProviderSection({
  title,
  description,
  icon,
  providers,
  onApiKeyChange,
  showApiKeyConfig,
}: ProviderSectionProps) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onApiKeyChange={onApiKeyChange}
            showApiKeyConfig={showApiKeyConfig}
          />
        ))}
      </div>
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  onApiKeyChange?: (id: string, hasKey: boolean) => void;
  showApiKeyConfig?: boolean;
}

function ProviderCard({
  provider,
  onApiKeyChange,
  showApiKeyConfig,
}: ProviderCardProps) {
  const { setApiKey, deleteApiKey, providers } = useApiKeys();
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Find provider info from useApiKeys
  const apiKeyInfo = providers.find((p) => p.provider_id === provider.id);
  const hasApiKey = apiKeyInfo?.has_key ?? false;

  const handleSaveKey = async () => {
    if (!keyValue.trim()) return;

    setSaving(true);
    const success = await setApiKey(provider.id, keyValue);
    if (success) {
      onApiKeyChange?.(provider.id, true);
      setEditing(false);
      setKeyValue("");
    }
    setSaving(false);
  };

  const handleDeleteKey = async () => {
    if (!confirm(`Remove API key for ${provider.name}?`)) return;

    await deleteApiKey(provider.id);
    onApiKeyChange?.(provider.id, false);
  };

  const handleCancel = () => {
    setEditing(false);
    setKeyValue("");
  };

  const docUrl = PROVIDER_DOCS[provider.id];
  const isAvailable = !provider.requiresApiKey || hasApiKey;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              isAvailable
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
          >
            {isAvailable ? (
              <Check className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">{provider.name}</p>
            {provider.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {provider.description}
              </p>
            )}
            {provider.requiresApiKey && (
              <p className="text-xs mt-1">
                {hasApiKey ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    API key configured
                    {apiKeyInfo?.key_prefix && (
                      <code className="ml-1 bg-muted px-1 rounded text-[10px]">
                        {apiKeyInfo.key_prefix}
                      </code>
                    )}
                  </span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    API key required
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {docUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(docUrl, "_blank")}
              title="Get API key"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {showApiKeyConfig && provider.requiresApiKey && (
            <>
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Key className="h-4 w-4 mr-1" />
                  {hasApiKey ? "Update" : "Add"}
                </Button>
              )}
              {hasApiKey && !editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteKey}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* API Key Input */}
      {editing && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={`Enter ${provider.name} API key...`}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono pr-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSaveKey}
              disabled={saving || !keyValue.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {docUrl && (
            <p className="text-xs text-muted-foreground mt-2">
              Get your API key from{" "}
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {provider.name} Developer Portal
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
