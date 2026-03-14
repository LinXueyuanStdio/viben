/**
 * Settings Model Page
 *
 * Unified settings page for managing API providers and their models.
 * Left sidebar: Provider list with add/delete
 * Right panel: Selected provider details (name, API Key, Base URL, models)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Server,
  Cpu,
  Search,
  X,
  Sparkles,
  Globe,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getModelIcon } from "@/lib/model-icons";
import {
  useProviders,
  type ProviderType,
  type Provider,
  DEFAULT_BASE_URLS,
  PROVIDER_TYPE_LABELS,
} from "@/hooks/use-providers";
import {
  useModels,
  type DiscoveredModel,
} from "@/hooks/use-models";
import { getGatewayClient, type WorkspaceModel } from "@/lib/gateway";


// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Provider type options
const PROVIDER_TYPES: ProviderType[] = [
  "openai",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "custom",
];

// Extended model type with source information
interface ExtendedModel extends DiscoveredModel {
  source: "discovered" | "predefined" | "manual";
}

export function SettingsModelPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const {
    providers,
    loading: providersLoading,
    error: providersError,
    createProvider,
    updateProvider,
    removeProvider,
    enableProvider,
    disableProvider,
  } = useProviders();

  const {
    error: modelsError,
    discoverProviderModels,
    listProviderEnabledModels,
    enableModelForProvider,
    disableModelForProvider,
  } = useModels();

  // Selected provider
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) || null,
    [providers, selectedProviderId]
  );

  // Model discovery state
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [predefinedModels, setPredefinedModels] = useState<WorkspaceModel[]>([]);
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>([]);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  // Dialog states
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);
  const [showAddModelDialog, setShowAddModelDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  // Add model form states
  const [newModelId, setNewModelId] = useState("");

  // Provider form states
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ProviderType>("openai");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  // Auto-select first provider
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  // Load models when provider changes
  const loadProviderModels = useCallback(async (providerId: string) => {
    setDiscoveringModels(true);
    setDiscoveredModels([]);
    setPredefinedModels([]);
    setEnabledModelIds([]);
    try {
      // Load enabled models and try to discover from provider API
      const [discovered, enabled] = await Promise.all([
        discoverProviderModels(providerId).catch(() => [] as DiscoveredModel[]),
        listProviderEnabledModels(providerId),
      ]);
      setDiscoveredModels(discovered);
      setEnabledModelIds(enabled);

      // Also load predefined models from Gateway for reference
      try {
        const client = getGatewayClient();
        const response = await client.getModels({ includeProviderPredefined: true });
        // Filter predefined models by provider type if possible
        const provider = providers.find((p) => p.id === providerId);
        if (provider) {
          const filtered = response.models.filter(
            (m) => m.provider_id.toLowerCase() === provider.provider_type.toLowerCase() ||
                   m.provider_name.toLowerCase().includes(provider.provider_type.toLowerCase())
          );
          setPredefinedModels(filtered);
        } else {
          setPredefinedModels(response.models);
        }
      } catch (gatewayErr) {
        console.warn("Failed to load predefined models from Gateway:", gatewayErr);
      }
    } catch (err) {
      console.error("Failed to load provider models:", err);
    } finally {
      setDiscoveringModels(false);
    }
  }, [discoverProviderModels, listProviderEnabledModels, providers]);

  useEffect(() => {
    if (selectedProviderId) {
      loadProviderModels(selectedProviderId);
    }
  }, [selectedProviderId, loadProviderModels]);

  // Combine discovered models, predefined models, and manually added models with source info
  const allModels = useMemo((): ExtendedModel[] => {
    const existingIds = new Set<string>();
    const result: ExtendedModel[] = [];

    // First add discovered models
    for (const m of discoveredModels) {
      existingIds.add(m.id);
      result.push({ ...m, source: "discovered" });
    }

    // Then add predefined models (if not already discovered)
    for (const m of predefinedModels) {
      if (!existingIds.has(m.id)) {
        existingIds.add(m.id);
        result.push({
          id: m.id,
          name: m.name,
          description: undefined,
          context_window: m.context_window ?? undefined,
          max_output_tokens: undefined,
          owned_by: undefined,
          created: undefined,
          source: "predefined",
        });
      }
    }

    // Finally add manually enabled models (not in discovered or predefined)
    for (const id of enabledModelIds) {
      if (!existingIds.has(id)) {
        existingIds.add(id);
        result.push({
          id,
          name: id,
          description: undefined,
          context_window: undefined,
          max_output_tokens: undefined,
          owned_by: undefined,
          created: undefined,
          source: "manual",
        });
      }
    }

    return result;
  }, [discoveredModels, predefinedModels, enabledModelIds]);

  // Sort models: enabled first, then by source (discovered > predefined > manual), then by name
  const sortedModels = useMemo(() => {
    const sourceOrder = { discovered: 0, predefined: 1, manual: 2 };
    return [...allModels].sort((a, b) => {
      const aEnabled = enabledModelIds.includes(a.id);
      const bEnabled = enabledModelIds.includes(b.id);
      // Enabled models first
      if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
      // Then by source
      if (a.source !== b.source) return sourceOrder[a.source] - sourceOrder[b.source];
      // Then by name
      return a.name.localeCompare(b.name);
    });
  }, [allModels, enabledModelIds]);

  // Filtered models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return sortedModels;
    const query = modelSearchQuery.toLowerCase();
    return sortedModels.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
    );
  }, [sortedModels, modelSearchQuery]);

  // Model counts
  const enabledCount = enabledModelIds.length;
  const totalCount = allModels.length;

  // Open add provider dialog
  const openAddProviderDialog = () => {
    setFormName("");
    setFormType("openai");
    setFormApiKey("");
    setFormBaseUrl(DEFAULT_BASE_URLS["openai"]);
    setShowApiKey(false);
    setEditingProvider(null);
    setShowAddProviderDialog(true);
  };

  // Handle provider type change
  const handleTypeChange = (type: ProviderType) => {
    setFormType(type);
    if (!editingProvider) {
      setFormBaseUrl(DEFAULT_BASE_URLS[type]);
    }
  };

  // Handle provider form submit
  const handleProviderSubmit = async () => {
    if (!formName.trim()) return;

    setFormSubmitting(true);
    try {
      if (editingProvider) {
        await updateProvider(editingProvider, {
          name: formName.trim(),
          provider_type: formType,
          api_key: formApiKey || undefined,
          base_url: formBaseUrl || undefined,
        });
      } else {
        const newProvider = await createProvider({
          name: formName.trim(),
          provider_type: formType,
          api_key: formApiKey || undefined,
          base_url: formBaseUrl || DEFAULT_BASE_URLS[formType],
          set_as_default: providers.length === 0,
        });
        setSelectedProviderId(newProvider.id);
      }
      setShowAddProviderDialog(false);
    } catch (err) {
      console.error("Failed to save provider:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle provider delete
  const handleDeleteProvider = async (id: string, name: string) => {
    if (!confirm(t("settingsModel.deleteProviderConfirm", { name }))) return;
    try {
      await removeProvider(id);
      if (selectedProviderId === id) {
        const remaining = providers.filter((p) => p.id !== id);
        setSelectedProviderId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  };

  // Handle provider toggle
  const handleToggleProvider = async (provider: Provider) => {
    try {
      if (provider.enabled) {
        await disableProvider(provider.id);
      } else {
        await enableProvider(provider.id);
      }
    } catch (err) {
      console.error("Failed to toggle provider:", err);
    }
  };

  // Handle model toggle
  const handleToggleModel = async (modelId: string) => {
    if (!selectedProviderId) return;
    try {
      if (enabledModelIds.includes(modelId)) {
        await disableModelForProvider(selectedProviderId, modelId);
        setEnabledModelIds((prev) => prev.filter((id) => id !== modelId));
      } else {
        await enableModelForProvider(selectedProviderId, modelId);
        setEnabledModelIds((prev) => [...prev, modelId]);
      }
    } catch (err) {
      console.error("Failed to toggle model:", err);
    }
  };

  // Handle refresh models
  const handleRefreshModels = async () => {
    if (!selectedProviderId) return;
    await loadProviderModels(selectedProviderId);
  };

  // Handle add model manually
  const handleAddModelManually = async () => {
    if (!selectedProviderId || !newModelId.trim()) return;
    try {
      await enableModelForProvider(selectedProviderId, newModelId.trim());
      setEnabledModelIds((prev) => [...prev, newModelId.trim()]);
      setNewModelId("");
      setShowAddModelDialog(false);
    } catch (err) {
      console.error("Failed to add model:", err);
    }
  };

  // Handle delete model
  const handleDeleteModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProviderId) return;
    try {
      await disableModelForProvider(selectedProviderId, modelId);
      setEnabledModelIds((prev) => prev.filter((id) => id !== modelId));
    } catch (err) {
      console.error("Failed to delete model:", err);
    }
  };

  // Get source icon and tooltip
  const getSourceInfo = (source: ExtendedModel["source"]) => {
    switch (source) {
      case "discovered":
        return {
          icon: Globe,
          tooltip: t("settingsModel.sourceDiscovered"),
          className: "text-blue-500",
        };
      case "predefined":
        return {
          icon: Sparkles,
          tooltip: t("settingsModel.sourcePredefined"),
          className: "text-amber-500",
        };
      case "manual":
        return {
          icon: PenLine,
          tooltip: t("settingsModel.sourceManual"),
          className: "text-muted-foreground",
        };
    }
  };

  const error = providersError || modelsError;

  if (providersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      className="h-full flex flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-4">
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settingsModel.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsModel.description")}
        </p>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          variants={itemVariants}
          className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}

      {/* Main Content */}
      <motion.div
        variants={itemVariants}
        className="flex-1 flex gap-4 min-h-0"
      >
        {/* Left Sidebar - Provider List */}
        <div className="w-64 flex flex-col rounded-xl border bg-card">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("settingsModel.providers")}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openAddProviderDialog}
              title={t("settingsModel.addProvider")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {providers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("settingsModel.noProviders")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={openAddProviderDialog}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("settingsModel.addFirst")}
                  </Button>
                </div>
              ) : (
                providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProviderId(provider.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg transition-all duration-200",
                      "hover:bg-muted/80",
                      selectedProviderId === provider.id
                        ? "bg-primary/10 border border-primary/30"
                        : "border border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {provider.name}
                      </span>
                      {provider.enabled ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-green-500/10 text-green-600 border-green-500/30">
                          {t("settingsModel.configured")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                          {t("common.disabled")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_TYPE_LABELS[provider.provider_type]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Sidebar Footer - Delete Button */}
          {selectedProvider && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteProvider(selectedProvider.id, selectedProvider.name)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("settingsModel.deleteProvider")}
              </Button>
            </div>
          )}
        </div>

        {/* Right Panel - Provider Details */}
        <div className="flex-1 flex flex-col rounded-xl border bg-card min-w-0">
          {selectedProvider ? (
            <>
              {/* Provider Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedProvider.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {PROVIDER_TYPE_LABELS[selectedProvider.provider_type]}
                  </span>
                </div>
                <Switch
                  checked={selectedProvider.enabled}
                  onCheckedChange={() => handleToggleProvider(selectedProvider)}
                />
              </div>

              {/* Provider Config Form */}
              <div className="p-4 border-b space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* API Key */}
                  <div className="space-y-2">
                    <Label>{t("settingsModel.apiKey")}</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={selectedProvider.api_key || ""}
                        placeholder={t("settingsModel.apiKeyPlaceholder")}
                        className="pr-10"
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-2">
                    <Label>{t("settingsModel.baseUrl")}</Label>
                    <Input
                      value={selectedProvider.base_url || DEFAULT_BASE_URLS[selectedProvider.provider_type] || ""}
                      placeholder={t("settingsModel.baseUrlPlaceholder")}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Models Section */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{t("settingsModel.models")}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {enabledCount}/{totalCount}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder={t("settingsModel.searchModels")}
                        className="pl-8 h-8 w-48"
                      />
                      {modelSearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full w-8"
                          onClick={() => setModelSearchQuery("")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRefreshModels}
                      disabled={discoveringModels}
                      title={t("settingsModel.refreshModels")}
                    >
                      {discoveringModels ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowAddModelDialog(true)}
                      title={t("settingsModel.addModel")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {discoveringModels ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        <p className="text-sm">{t("settingsModel.discoveringModels")}</p>
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Cpu className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {modelSearchQuery
                            ? t("settingsModel.noModelsMatchSearch")
                            : t("settingsModel.noModelsFound")}
                        </p>
                        {!modelSearchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setShowAddModelDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t("settingsModel.addModelManually")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      filteredModels.map((model) => {
                        const isEnabled = enabledModelIds.includes(model.id);
                        const sourceInfo = getSourceInfo(model.source);
                        const SourceIcon = sourceInfo.icon;
                        return (
                          <div
                            key={model.id}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all duration-200 group",
                              "hover:bg-muted/50",
                              isEnabled
                                ? "bg-primary/5 border-primary/30"
                                : "border-transparent bg-muted/30"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => handleToggleModel(model.id)}
                                className="flex items-center gap-2 flex-1 min-w-0"
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                                  isEnabled
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground/30"
                                )}>
                                  {isEnabled && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <span className="flex-shrink-0">
                                  {getModelIcon(model.id, { size: 16 })}
                                </span>
                                <span className="font-medium text-sm truncate">{model.name}</span>
                              </button>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SourceIcon className={cn("h-3.5 w-3.5", sourceInfo.className)} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">{sourceInfo.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {model.context_window && (
                                  <Badge variant="outline" className="text-xs">
                                    {(model.context_window / 1000).toFixed(0)}K
                                  </Badge>
                                )}
                                {isEnabled && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={(e) => handleDeleteModel(model.id, e)}
                                    title={t("settingsModel.deleteModel")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleModel(model.id)}
                              className="w-full text-left"
                            >
                              {model.description && (
                                <p className="text-xs text-muted-foreground mt-1 ml-7 line-clamp-1">
                                  {model.description}
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground/70 mt-0.5 ml-7 font-mono">
                                {model.id}
                              </div>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t("settingsModel.selectProvider")}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Provider Dialog */}
      <Dialog open={showAddProviderDialog} onOpenChange={setShowAddProviderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider
                ? t("settingsModel.editProvider")
                : t("settingsModel.addProvider")}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? t("settingsModel.editProviderDescription")
                : t("settingsModel.addProviderDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="provider-name">{t("settingsModel.providerName")}</Label>
              <Input
                id="provider-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settingsModel.providerNamePlaceholder")}
              />
            </div>

            {/* Provider Type */}
            <div className="space-y-2">
              <Label htmlFor="provider-type">{t("settingsModel.providerType")}</Label>
              <Select value={formType} onValueChange={(v) => handleTypeChange(v as ProviderType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PROVIDER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="provider-api-key">{t("settingsModel.apiKey")}</Label>
              <div className="relative">
                <Input
                  id="provider-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={t("settingsModel.apiKeyPlaceholder")}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {formType !== "ollama" && (
                <p className="text-xs text-muted-foreground">
                  {t("settingsModel.apiKeyHint")}
                </p>
              )}
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="provider-base-url">{t("settingsModel.baseUrl")}</Label>
              <Input
                id="provider-base-url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URLS[formType] || t("settingsModel.baseUrlPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsModel.baseUrlHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProviderDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleProviderSubmit} disabled={!formName.trim() || formSubmitting}>
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingProvider ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Model Dialog */}
      <Dialog open={showAddModelDialog} onOpenChange={setShowAddModelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsModel.addModel")}</DialogTitle>
            <DialogDescription>
              {t("settingsModel.addModelDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="model-id">{t("settingsModel.modelId")}</Label>
              <Input
                id="model-id"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder={t("settingsModel.modelIdPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsModel.modelIdHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModelDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAddModelManually} disabled={!newModelId.trim()}>
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
