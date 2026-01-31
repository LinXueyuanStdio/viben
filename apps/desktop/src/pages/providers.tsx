import { useState } from "react";
import { Check, X, ExternalLink, Key, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores";
import type { Provider } from "@/types";

export function ProvidersPage() {
  const { providers, setProviderEnabled, setProviderApiKey, apiKeys, setApiKey } =
    useAppStore();

  const freeProviders = providers.filter((p) => p.category === "free");
  const apiKeyProviders = providers.filter((p) => p.category === "api_key");
  const institutionalProviders = providers.filter((p) => p.category === "institutional");

  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {providers.length} providers enabled
          </p>
        </div>
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4 mr-2" />
          Add Custom
        </Button>
      </div>

      {/* Free & Open Access */}
      <ProviderSection
        title="Free & Open Access"
        description="No registration required"
        providers={freeProviders}
        onToggle={setProviderEnabled}
      />

      {/* API Key Required */}
      <ProviderSection
        title="API Key Required"
        description="Register for a free API key"
        providers={apiKeyProviders}
        onToggle={setProviderEnabled}
        onConfigureApiKey={(id) => {
          // In a real app, this would open a modal
          const key = prompt(`Enter API key for ${id}:`);
          if (key) {
            setApiKey(id, key);
            setProviderApiKey(id, true);
          }
        }}
        apiKeys={apiKeys}
      />

      {/* Institutional Access */}
      <ProviderSection
        title="Institutional Access"
        description="Requires institutional subscription"
        providers={institutionalProviders}
        onToggle={setProviderEnabled}
      />
    </div>
  );
}

interface ProviderSectionProps {
  title: string;
  description?: string;
  providers: Provider[];
  onToggle: (id: string, enabled: boolean) => void;
  onConfigureApiKey?: (id: string) => void;
  apiKeys?: Record<string, string | undefined>;
}

function ProviderSection({
  title,
  description,
  providers,
  onToggle,
  onConfigureApiKey,
  apiKeys,
}: ProviderSectionProps) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onToggle={onToggle}
            onConfigureApiKey={onConfigureApiKey}
            hasApiKey={apiKeys?.[provider.id] !== undefined}
          />
        ))}
      </div>
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  onToggle: (id: string, enabled: boolean) => void;
  onConfigureApiKey?: (id: string) => void;
  hasApiKey?: boolean;
}

function ProviderCard({
  provider,
  onToggle,
  onConfigureApiKey,
  hasApiKey,
}: ProviderCardProps) {
  const [testing, setTesting] = useState(false);

  const handleToggle = () => {
    // If provider requires API key and doesn't have one, prompt first
    if (provider.requiresApiKey && !hasApiKey && !provider.enabled) {
      onConfigureApiKey?.(provider.id);
    } else {
      onToggle(provider.id, !provider.enabled);
    }
  };

  const canEnable = !provider.requiresApiKey || hasApiKey;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={!canEnable && !provider.enabled}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            provider.enabled
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : canEnable
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
          }`}
        >
          {provider.enabled ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </button>
        <div>
          <p className="font-medium">{provider.name}</p>
          {provider.requiresApiKey && (
            <p className="text-xs text-muted-foreground">
              {hasApiKey ? (
                <span className="text-green-600 dark:text-green-400">
                  API key configured
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
      <div className="flex gap-1">
        {provider.requiresApiKey && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfigureApiKey?.(provider.id)}
            title={hasApiKey ? "Update API key" : "Add API key"}
          >
            <Key className={`h-4 w-4 ${hasApiKey ? "text-green-600" : ""}`} />
          </Button>
        )}
      </div>
    </div>
  );
}
