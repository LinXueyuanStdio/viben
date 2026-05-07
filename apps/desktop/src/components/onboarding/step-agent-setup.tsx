/**
 * Step Agent Setup - Onboarding step for configuring the first agent
 *
 * Internal sub-steps: executor → provider → model
 * Guides the user through selecting an executor, configuring a provider (API key),
 * and choosing a model to create their first agent.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  SkipForward,
  Eye,
  EyeOff,
  Zap,
  Key,
  Bot,
  Check,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getGatewayClient,
  isAgentAvailable,
  type ExecutorInfo,
  type ExecutorType,
  type WorkspaceModel,
  type DiscoveredModel,
} from "@/lib/gateway";
import {
  getAllowedProviders,
  filterModelsByExecutor,
} from "@/lib/executor-constraints";
import {
  useProviders,
  DEFAULT_BASE_URLS,
  PROVIDER_TYPE_LABELS,
  type ProviderType,
  type Provider,
} from "@/hooks/use-providers";
import { useModels } from "@/hooks/use-models";
import { useExecutors } from "@/hooks/use-workspace-resources";
import { useGatewayStatus } from "@/hooks/use-gateway-status";

// ============================================================================
// Types
// ============================================================================

interface StepAgentSetupProps {
  onComplete: () => void;
  onBack: () => void;
}

type SubStep = "executor" | "provider" | "model";

/** Executor type to short icon label mapping (reused from ai-clients-section) */
const EXECUTOR_ICONS: Partial<Record<ExecutorType, string>> = {
  CLAUDE_CODE: "CC",
  CURSOR_AGENT: "Cu",
  CODEX: "Cx",
  GEMINI: "Ge",
  COPILOT: "Co",
  QWEN_CODE: "Qw",
  AMP: "Am",
  OPENCODE: "Oc",
  DROID: "Dr",
};

/** Runtime executor types to show in onboarding */
const RUNTIME_EXECUTOR_TYPES: ExecutorType[] = [
  "CLAUDE_CODE",
  "GEMINI",
  "CODEX",
  "AMP",
  "OPENCODE",
  "CURSOR_AGENT",
  "QWEN_CODE",
  "COPILOT",
  "DROID",
];

// ============================================================================
// Sub-step indicator
// ============================================================================

const SUB_STEPS: { key: SubStep; icon: typeof Zap }[] = [
  { key: "executor", icon: Zap },
  { key: "provider", icon: Key },
  { key: "model", icon: Bot },
];

function SubStepIndicator({ current, completed }: { current: SubStep; completed: SubStep[] }) {
  const currentIdx = SUB_STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {SUB_STEPS.map((step, idx) => {
        const isCompleted = completed.includes(step.key);
        const isCurrent = step.key === current;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && !isCompleted && "bg-primary/20 text-primary ring-1 ring-primary",
                !isCurrent && !isCompleted && "bg-muted text-muted-foreground",
              )}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            {idx < SUB_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-6 transition-colors",
                  idx < currentIdx || isCompleted ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Executor Select Sub-step
// ============================================================================

function ExecutorSelectView({
  executors,
  selectedExecutor,
  onSelect,
  t,
}: {
  executors: ExecutorInfo[];
  selectedExecutor: ExecutorType | null;
  onSelect: (type: ExecutorType) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const executorInfoMap = useMemo(() => {
    const map: Record<string, ExecutorInfo> = {};
    for (const e of executors) {
      map[e.type] = e;
    }
    return map;
  }, [executors]);

  const sortedTypes = useMemo(() => {
    return [...RUNTIME_EXECUTOR_TYPES].sort((a, b) => {
      const aInfo = executorInfoMap[a];
      const bInfo = executorInfoMap[b];
      const aAvail = aInfo?.availability ? isAgentAvailable(aInfo.availability) : false;
      const bAvail = bInfo?.availability ? isAgentAvailable(bInfo.availability) : false;
      if (aAvail && !bAvail) return -1;
      if (!aAvail && bAvail) return 1;
      return a.localeCompare(b);
    });
  }, [executorInfoMap]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">{t("onboarding.agentSetup.executor.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.agentSetup.executor.description")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {sortedTypes.map((type) => {
          const info = executorInfoMap[type];
          const isAvailable = info?.availability ? isAgentAvailable(info.availability) : false;
          const isSelected = selectedExecutor === type;
          const displayName = info?.name || type.replace(/_/g, " ");
          const iconLabel = EXECUTOR_ICONS[type] || type.slice(0, 2);

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors hover:bg-accent/50",
                isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                !isSelected && "border-border",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold",
                  isAvailable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {iconLabel}
              </div>
              <span className="text-xs font-medium truncate w-full text-center">{displayName}</span>
              {isAvailable && (
                <span className="text-[10px] text-green-600 dark:text-green-400">
                  {t("onboarding.agentSetup.executor.available")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Provider Config Sub-step
// ============================================================================

function ProviderConfigView({
  executorType,
  existingProviders,
  onProviderReady,
  onProvidersChanged,
  t,
}: {
  executorType: ExecutorType;
  existingProviders: Provider[];
  onProviderReady: (provider: Provider) => void;
  onProvidersChanged: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { createProvider, testConnection } = useProviders();

  const allowedProviders = useMemo(() => {
    return (getAllowedProviders(executorType) || []) as ProviderType[];
  }, [executorType]);

  // All existing providers that match the executor constraints
  const matchingProviders = useMemo(() => {
    return existingProviders.filter((p) => allowedProviders.includes(p.provider_type));
  }, [existingProviders, allowedProviders]);

  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(
    matchingProviders[0]?.id || null,
  );
  const [showAddForm, setShowAddForm] = useState(matchingProviders.length === 0);
  const [selectedProviderType, setSelectedProviderType] = useState<ProviderType>(
    allowedProviders[0] || "anthropic",
  );
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URLS[allowedProviders[0] || "anthropic"] || "");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(DEFAULT_BASE_URLS[selectedProviderType] || "");
    setTestResult(null);
  }, [selectedProviderType]);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      // Create the provider first, then test
      const provider = await createProvider({
        provider_type: selectedProviderType,
        name: PROVIDER_TYPE_LABELS[selectedProviderType] || selectedProviderType,
        api_key: apiKey.trim(),
        base_url: baseUrl.trim() || undefined,
        set_as_default: matchingProviders.length === 0,
      });
      const result = await testConnection(provider.id);
      setTestResult({ success: result.connected, error: result.error });
      if (result.connected) {
        onProvidersChanged();
        onProviderReady(provider);
        return;
      }
      // Even if test failed, provider was created — notify parent
      onProvidersChanged();
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError(t("onboarding.agentSetup.provider.apiKeyPlaceholder"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const provider = await createProvider({
        provider_type: selectedProviderType,
        name: PROVIDER_TYPE_LABELS[selectedProviderType] || selectedProviderType,
        api_key: apiKey.trim(),
        base_url: baseUrl.trim() || undefined,
        set_as_default: matchingProviders.length === 0,
      });
      onProvidersChanged();
      onProviderReady(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseExisting = () => {
    const p = matchingProviders.find((p) => p.id === selectedExistingId);
    if (p) onProviderReady(p);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">{t("onboarding.agentSetup.provider.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.agentSetup.provider.description", { executor: executorType.replace(/_/g, " ") })}
        </p>
      </div>

      {/* Existing providers */}
      {matchingProviders.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t("onboarding.agentSetup.provider.alreadyConfigured")}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("onboarding.agentSetup.provider.addNew")}
            </Button>
          </div>

          {/* Provider list */}
          <div className="space-y-2">
            {matchingProviders.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedExistingId(p.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  selectedExistingId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <div>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {PROVIDER_TYPE_LABELS[p.provider_type] || p.provider_type}
                  </span>
                </div>
                {selectedExistingId === p.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>

          <Button className="w-full" onClick={handleUseExisting} disabled={!selectedExistingId}>
            {t("onboarding.agentSetup.provider.saveAndContinue")}
          </Button>
        </div>
      )}

      {/* Add new provider form */}
      {showAddForm && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <Label className="text-sm font-medium">
            {t("onboarding.agentSetup.provider.addNew")}
          </Label>

          {/* Provider type selector */}
          {allowedProviders.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("onboarding.agentSetup.provider.providerLabel")}</Label>
              <Select
                value={selectedProviderType}
                onValueChange={(v) => setSelectedProviderType(v as ProviderType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_TYPE_LABELS[p as ProviderType] || p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {allowedProviders.length === 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {PROVIDER_TYPE_LABELS[allowedProviders[0] as ProviderType] || allowedProviders[0]}
              </span>
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("onboarding.agentSetup.provider.apiKey")}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={t("onboarding.agentSetup.provider.apiKeyPlaceholder")}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                  setError(null);
                }}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("onboarding.agentSetup.provider.apiKeyHint")}
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("onboarding.agentSetup.provider.baseUrl")}
            </Label>
            <Input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 text-sm",
                testResult.success
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {testResult.success
                  ? t("onboarding.agentSetup.provider.connectionSuccess")
                  : t("onboarding.agentSetup.provider.connectionFailed", {
                      error: testResult.error || "Unknown error",
                    })}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !apiKey.trim()}
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("onboarding.agentSetup.provider.testing")}
                </>
              ) : (
                t("onboarding.agentSetup.provider.testConnection")
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !apiKey.trim()}
              className="flex-1"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("onboarding.agentSetup.provider.saveAndContinue")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Model Select Sub-step
// ============================================================================

function ModelSelectView({
  executorType,
  provider,
  models,
  modelsLoading,
  agentName,
  onAgentNameChange,
  selectedModel,
  onModelSelect,
  onCreateAgent,
  isCreating,
  createError,
  onModelsRefresh,
  t,
}: {
  executorType: ExecutorType;
  provider: Provider | null;
  models: WorkspaceModel[];
  modelsLoading: boolean;
  agentName: string;
  onAgentNameChange: (name: string) => void;
  selectedModel: string | null;
  onModelSelect: (modelId: string) => void;
  onCreateAgent: () => void;
  isCreating: boolean;
  createError: string | null;
  onModelsRefresh: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { discoverProviderModels, enableModelForProvider, disableModelForProvider } = useModels();

  // Discovered models from provider API
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState("");

  // Available models from the global model list (filtered by executor)
  const filteredModels = useMemo(() => {
    return filterModelsByExecutor(models, executorType);
  }, [models, executorType]);

  // Load discovered models and enabled model IDs on mount
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    const load = async () => {
      setIsDiscovering(true);
      try {
        const client = getGatewayClient();
        const [discovered, enabledIds] = await Promise.all([
          discoverProviderModels(provider.id).catch(() => [] as DiscoveredModel[]),
          client.listProviderEnabledModels(provider.id).catch(() => [] as string[]),
        ]);
        if (!cancelled) {
          setDiscoveredModels(discovered);
          setEnabledModelIds(enabledIds);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsDiscovering(false);
      }
    };
    load();

    return () => { cancelled = true; };
  }, [provider, discoverProviderModels]);

  // Merge: discovered models + already-enabled from gateway models list
  const allDiscoveredModels = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string; enabled: boolean }[] = [];

    // Enabled model IDs from provider
    for (const id of enabledModelIds) {
      seen.add(id);
      const disc = discoveredModels.find((d) => d.id === id);
      result.push({ id, name: disc?.name || id, enabled: true });
    }

    // Discovered but not enabled
    for (const d of discoveredModels) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        result.push({ id: d.id, name: d.name || d.id, enabled: false });
      }
    }

    return result;
  }, [discoveredModels, enabledModelIds]);

  const handleToggleModel = async (modelId: string, currentlyEnabled: boolean) => {
    if (!provider) return;
    try {
      if (currentlyEnabled) {
        await disableModelForProvider(provider.id, modelId);
        setEnabledModelIds((prev) => prev.filter((id) => id !== modelId));
      } else {
        await enableModelForProvider(provider.id, modelId);
        setEnabledModelIds((prev) => [...prev, modelId]);
      }
      onModelsRefresh();
    } catch (err) {
      console.error("Failed to toggle model:", err);
    }
  };

  const handleAddModel = async () => {
    if (!provider || !newModelId.trim()) return;
    try {
      await enableModelForProvider(provider.id, newModelId.trim());
      setEnabledModelIds((prev) => [...prev, newModelId.trim()]);
      setNewModelId("");
      setShowAddModel(false);
      onModelsRefresh();
    } catch (err) {
      console.error("Failed to add model:", err);
    }
  };

  const handleRefreshDiscovery = async () => {
    if (!provider) return;
    setIsDiscovering(true);
    try {
      const discovered = await discoverProviderModels(provider.id).catch(() => [] as DiscoveredModel[]);
      setDiscoveredModels(discovered);
    } catch {
      // ignore
    } finally {
      setIsDiscovering(false);
    }
  };

  // For the agent model selector, use the global filtered models (which reflect enabled state)
  const selectableModels = useMemo(() => {
    return filteredModels.filter((m) => m.is_available);
  }, [filteredModels]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">{t("onboarding.agentSetup.model.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.agentSetup.model.description")}
        </p>
      </div>

      {/* Model management: discover + toggle */}
      {provider && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t("onboarding.agentSetup.model.manageModels")}
            </Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModel(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("onboarding.agentSetup.model.addModel")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshDiscovery}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Add model manually */}
          {showAddModel && (
            <div className="flex gap-2">
              <Input
                placeholder={t("onboarding.agentSetup.model.modelIdPlaceholder")}
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                className="flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddModel();
                }}
              />
              <Button size="sm" onClick={handleAddModel} disabled={!newModelId.trim()}>
                {t("onboarding.agentSetup.model.addModel")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddModel(false); setNewModelId(""); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Model list */}
          {isDiscovering && allDiscoveredModels.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("onboarding.agentSetup.model.discovering")}</span>
            </div>
          ) : allDiscoveredModels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {t("onboarding.agentSetup.model.noDiscoveredModels")}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allDiscoveredModels.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <span className="text-sm truncate flex-1 mr-2" title={m.id}>
                    {m.name}
                  </span>
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={() => handleToggleModel(m.id, m.enabled)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent config: name + model selector + create */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        {/* Agent name */}
        <div className="space-y-2">
          <Label className="text-sm">{t("onboarding.agentSetup.model.agentName")}</Label>
          <Input
            value={agentName}
            onChange={(e) => onAgentNameChange(e.target.value)}
            placeholder={t("onboarding.agentSetup.model.agentNamePlaceholder")}
          />
        </div>

        {/* Model selection */}
        <div className="space-y-2">
          <Label className="text-sm">{t("onboarding.agentSetup.model.selectModel")}</Label>
          {modelsLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("onboarding.agentSetup.model.loadingModels")}</span>
            </div>
          ) : selectableModels.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              {t("onboarding.agentSetup.model.noModels")}
            </div>
          ) : (
            <Select value={selectedModel || ""} onValueChange={onModelSelect}>
              <SelectTrigger>
                <SelectValue placeholder={t("onboarding.agentSetup.model.selectModelPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {selectableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span>{m.name || m.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Create error */}
        {createError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t("onboarding.agentSetup.model.error", { error: createError })}</span>
          </div>
        )}

        {/* Create button */}
        <Button
          className="w-full"
          onClick={onCreateAgent}
          disabled={isCreating || !agentName.trim()}
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("onboarding.agentSetup.model.creating")}
            </>
          ) : (
            t("onboarding.agentSetup.model.createAgent")
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Success View
// ============================================================================

function SuccessView({ agentName, t }: { agentName: string; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div className="text-center">
          <p className="font-medium">{t("onboarding.agentSetup.model.success")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{agentName}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StepAgentSetup({ onComplete, onBack }: StepAgentSetupProps) {
  const { t } = useTranslation();
  const { isConnected } = useGatewayStatus();
  const { executors } = useExecutors();
  const { providers, refresh: refreshProviders } = useProviders();
  const { models, loading: modelsLoading, refresh: refreshModels } = useModels();

  // Sub-step state
  const [subStep, setSubStep] = useState<SubStep>("executor");
  const [completedSubSteps, setCompletedSubSteps] = useState<SubStep[]>([]);

  // Form state
  const [selectedExecutor, setSelectedExecutor] = useState<ExecutorType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [agentName, setAgentName] = useState(t("onboarding.agentSetup.model.agentNamePlaceholder"));

  // Agent creation state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [agentCreated, setAgentCreated] = useState(false);

  const completeSubStep = (step: SubStep) => {
    if (!completedSubSteps.includes(step)) {
      setCompletedSubSteps((prev) => [...prev, step]);
    }
  };

  const handleExecutorSelect = (type: ExecutorType) => {
    setSelectedExecutor(type);
    completeSubStep("executor");
    setSubStep("provider");
  };

  const handleProviderReady = (provider: Provider) => {
    setSelectedProvider(provider);
    completeSubStep("provider");
    setSubStep("model");
    refreshModels();
  };

  const handleCreateAgent = useCallback(async () => {
    if (!selectedExecutor || !agentName.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const client = getGatewayClient();
      const agent = await client.createAgent({
        name: agentName.trim(),
        model: selectedModel || undefined,
        provider: selectedProvider?.provider_type || undefined,
      });
      await client.updateAgent(agent.id, {
        executor_type: selectedExecutor,
      });
      completeSubStep("model");
      setAgentCreated(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  }, [selectedExecutor, selectedModel, selectedProvider, agentName]);

  const handleSkip = () => {
    onComplete();
  };

  const handleSubStepBack = () => {
    if (subStep === "model") {
      setSubStep("provider");
    } else if (subStep === "provider") {
      setSubStep("executor");
    } else {
      onBack();
    }
  };

  // Gateway not running
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">{t("onboarding.agentSetup.title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("onboarding.agentSetup.description")}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-sm text-center text-muted-foreground">
              {t("onboarding.agentSetup.gatewayRequired")}
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            {t("common.previous")}
          </Button>
          <Button variant="ghost" onClick={handleSkip}>
            <SkipForward className="mr-2 h-4 w-4" />
            {t("onboarding.agentSetup.skip")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.agentSetup.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("onboarding.agentSetup.description")}</p>
      </div>

      {/* Sub-step indicator */}
      {!agentCreated && (
        <SubStepIndicator current={subStep} completed={completedSubSteps} />
      )}

      {/* Content */}
      {agentCreated ? (
        <SuccessView agentName={agentName} t={t} />
      ) : (
        <>
          {subStep === "executor" && (
            <ExecutorSelectView
              executors={executors}
              selectedExecutor={selectedExecutor}
              onSelect={handleExecutorSelect}
              t={t}
            />
          )}
          {subStep === "provider" && selectedExecutor && (
            <ProviderConfigView
              executorType={selectedExecutor}
              existingProviders={providers}
              onProviderReady={handleProviderReady}
              onProvidersChanged={refreshProviders}
              t={t}
            />
          )}
          {subStep === "model" && selectedExecutor && (
            <ModelSelectView
              executorType={selectedExecutor}
              provider={selectedProvider}
              models={models}
              modelsLoading={modelsLoading}
              agentName={agentName}
              onAgentNameChange={setAgentName}
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              onCreateAgent={handleCreateAgent}
              isCreating={isCreating}
              createError={createError}
              onModelsRefresh={refreshModels}
              t={t}
            />
          )}
        </>
      )}

      {/* Skip hint */}
      {!agentCreated && (
        <p className="text-center text-xs text-muted-foreground">
          {t("onboarding.agentSetup.skipHint")}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={agentCreated ? onBack : handleSubStepBack}
          disabled={isCreating}
        >
          {t("common.previous")}
        </Button>
        {agentCreated ? (
          <Button onClick={onComplete}>{t("onboarding.login.finish")}</Button>
        ) : (
          <Button variant="ghost" onClick={handleSkip} disabled={isCreating}>
            <SkipForward className="mr-2 h-4 w-4" />
            {t("onboarding.agentSetup.skip")}
          </Button>
        )}
      </div>
    </div>
  );
}
