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
  Eye,
  EyeOff,
  Server,
  Cpu,
  Search,
  X,
  Globe,
  PenLine,
  Star,
  Settings2,
  ChevronRight,
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
  type ProviderCategory,
  type ProviderSurface,
  type Provider,
  DEFAULT_BASE_URLS,
  PROVIDER_TYPE_LABELS,
} from "@/hooks/use-providers";
import {
  useModels,
  type ModelSurface,
} from "@/hooks/use-models";
import { getGatewayClient } from "@/lib/gateway";
import {
  buildProviderModelList,
  getProviderSurfaces,
  type SettingsModel,
} from "./settings-model-utils";


// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Provider type options
const PROVIDER_TYPES: ProviderType[] = [
  "openai",
  "openai-responses",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "google",
  "volcengine",
  "grok",
  "nanobanana",
  "imagerouter",
  "fal",
  "leonardo",
  "minimax",
  "elevenlabs",
  "fishaudio",
  "senseaudio",
  "aihubmix",
  "suno",
  "udio",
];

const MEDIA_SURFACES: ProviderSurface[] = [
  "image",
  "video",
  "music",
  "speech",
  "sfx",
];

const SURFACE_LABELS: Record<ProviderSurface, string> = {
  chat: "Chat",
  image: "Image",
  video: "Video",
  music: "Music",
  speech: "Voice",
  sfx: "SFX",
};

function getDefaultCategory(type: ProviderType): ProviderCategory {
  return [
    "volcengine",
    "grok",
    "nanobanana",
    "imagerouter",
    "fal",
    "leonardo",
    "minimax",
    "elevenlabs",
    "fishaudio",
    "senseaudio",
    "aihubmix",
    "suno",
    "udio",
  ].includes(type)
    ? "media"
    : "llm";
}

function getDefaultSurfaces(type: ProviderType): ProviderSurface[] {
  switch (type) {
    case "nanobanana":
    case "imagerouter":
    case "leonardo":
      return ["image"];
    case "fal":
    case "volcengine":
    case "minimax":
    case "aihubmix":
      return ["image", "video"];
    case "elevenlabs":
    case "fishaudio":
    case "senseaudio":
      return ["speech", "sfx"];
    case "suno":
    case "udio":
      return ["music"];
    default:
      return getDefaultCategory(type) === "media" ? ["image"] : ["chat"];
  }
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

  const [selectedSurface, setSelectedSurface] = useState<ProviderSurface>("chat");

  const {
    error: modelsError,
    defaultModelId,
    setDefaultModel,
    discoverProviderModels,
    listProviderConfiguredModels,
    enableModelForProvider,
    disableModelForProvider,
  } = useModels({
    category: selectedSurface === "chat" ? "llm" : "media",
    surface: selectedSurface as ModelSurface,
  });

  // Selected provider
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) || null,
    [providers, selectedProviderId]
  );

  // Model discovery state
  const [models, setModels] = useState<SettingsModel[]>([]);
  const [apiDiscoveredIds, setApiDiscoveredIds] = useState<Set<string>>(new Set());
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
  const [formCategory, setFormCategory] = useState<ProviderCategory>("llm");
  const [formSurfaces, setFormSurfaces] = useState<ProviderSurface[]>(["chat"]);
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
        staggerChildren: prefersReducedMotion ? 0 : 0.04,
        delayChildren: prefersReducedMotion ? 0 : 0.02,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.25,
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

  useEffect(() => {
    if (!selectedProvider) return;
    const surfaces: ProviderSurface[] = selectedProvider.surfaces.length > 0
      ? selectedProvider.surfaces
      : selectedProvider.category === "media"
        ? ["image"]
        : ["chat"];
    if (!surfaces.includes(selectedSurface)) {
      setSelectedSurface(surfaces[0]);
    }
  }, [selectedProvider, selectedSurface]);

  // Load models when provider changes
  useEffect(() => {
    if (!selectedProviderId) return;

    let stale = false;
    const provider = providers.find((p) => p.id === selectedProviderId);

    setDiscoveringModels(true);
    setModels([]);
    setEnabledModelIds([]);

    (async () => {
      try {
        const [discovered, configured] = await Promise.all([
          discoverProviderModels(selectedProviderId).catch(() => []),
          listProviderConfiguredModels(selectedProviderId),
        ]);
        if (stale) return;

        const result = buildProviderModelList({
          provider,
          discovered,
          configured,
        });
        setApiDiscoveredIds(result.apiDiscoveredIds);
        setModels(result.models);
        setEnabledModelIds(result.enabledModelIds);
      } catch (err) {
        if (!stale) {
          console.error("Failed to load provider models:", err);
        }
      } finally {
        if (!stale) {
          setDiscoveringModels(false);
        }
      }
    })();

    return () => { stale = true; };
  }, [selectedProviderId, providers, discoverProviderModels, listProviderConfiguredModels]);

  // Manual refresh handler
  const loadProviderModels = useCallback(async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);

    setDiscoveringModels(true);
    setModels([]);
    setEnabledModelIds([]);

    try {
      const [discovered, configured] = await Promise.all([
        discoverProviderModels(providerId).catch(() => []),
        listProviderConfiguredModels(providerId),
      ]);

      const result = buildProviderModelList({
        provider,
        discovered,
        configured,
      });
      setApiDiscoveredIds(result.apiDiscoveredIds);
      setModels(result.models);
      setEnabledModelIds(result.enabledModelIds);
    } catch (err) {
      console.error("Failed to load provider models:", err);
    } finally {
      setDiscoveringModels(false);
    }
  }, [discoverProviderModels, listProviderConfiguredModels, providers]);

  // Sort models: enabled first, then by name
  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [models]);

  // Filtered models based on search
  const filteredModels = useMemo(() => {
    const surfaceModels = sortedModels.filter(
      (model) => !model.surface || model.surface === selectedSurface
    );
    if (!modelSearchQuery.trim()) return surfaceModels;
    const query = modelSearchQuery.toLowerCase();
    return surfaceModels.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
    );
  }, [sortedModels, modelSearchQuery, selectedSurface]);

  // Model counts
  const enabledCount = enabledModelIds.length;
  const totalCount = models.length;
  const providerSurfaces: ProviderSurface[] = getProviderSurfaces(selectedProvider);
  const currentDefaultModelId = defaultModelId;

  // Open add provider dialog
  const openAddProviderDialog = () => {
    setFormName("");
    setFormType("openai");
    setFormCategory("llm");
    setFormSurfaces(["chat"]);
    setFormApiKey("");
    setFormBaseUrl(DEFAULT_BASE_URLS["openai"]);
    setShowApiKey(false);
    setEditingProvider(null);
    setShowAddProviderDialog(true);
  };

  // Open edit provider dialog
  const openEditProviderDialog = (provider: Provider) => {
    setFormName(provider.name);
    setFormType(provider.provider_type);
    setFormCategory(provider.category);
    setFormSurfaces(provider.surfaces);
    setFormApiKey(provider.api_key || "");
    setFormBaseUrl(provider.base_url || DEFAULT_BASE_URLS[provider.provider_type] || "");
    setShowApiKey(false);
    setEditingProvider(provider.id);
    setShowAddProviderDialog(true);
  };

  // Handle provider type change
  const handleTypeChange = (type: ProviderType) => {
    setFormType(type);
    const nextCategory = getDefaultCategory(type);
    setFormCategory(nextCategory);
    setFormSurfaces(getDefaultSurfaces(type));
    if (!editingProvider) {
      setFormBaseUrl(DEFAULT_BASE_URLS[type]);
    }
  };

  const handleCategoryChange = (category: ProviderCategory) => {
    setFormCategory(category);
    setFormSurfaces(category === "llm" ? ["chat"] : ["image"]);
  };

  const handleSurfaceToggle = (surface: ProviderSurface) => {
    setFormSurfaces((prev) => {
      if (surface === "chat") return ["chat"];
      const withoutChat = prev.filter((item) => item !== "chat");
      if (withoutChat.includes(surface)) {
        const next = withoutChat.filter((item) => item !== surface);
        return next.length > 0 ? next : [surface];
      }
      return [...withoutChat, surface];
    });
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
          category: formCategory,
          api_key: formApiKey || undefined,
          base_url: formBaseUrl || undefined,
          surfaces: formSurfaces,
        });
      } else {
        const newProvider = await createProvider({
          name: formName.trim(),
          provider_type: formType,
          category: formCategory,
          api_key: formApiKey || undefined,
          base_url: formBaseUrl || DEFAULT_BASE_URLS[formType],
          surfaces: formSurfaces,
          supports_custom_model: true,
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
        setModels((prev) => prev.map((model) => (
          model.id === modelId ? { ...model, enabled: false } : model
        )));
      } else {
        await enableModelForProvider(selectedProviderId, modelId);
        setEnabledModelIds((prev) => [...prev, modelId]);
        setModels((prev) => prev.map((model) => (
          model.id === modelId ? { ...model, enabled: true } : model
        )));
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
    const modelId = newModelId.trim();
    try {
      if (selectedProvider) {
        const client = getGatewayClient();
        await client.createModel({
          id: modelId,
          name: modelId,
          provider: selectedProvider.provider_type,
          provider_id: selectedProvider.id,
          category: selectedProvider.category,
          surface: selectedSurface as ModelSurface,
        });
      }
      await enableModelForProvider(selectedProviderId, modelId);
      setModels((prev) => {
        if (prev.some((m) => m.id === modelId)) return prev;
        return [...prev, {
          id: modelId,
          name: modelId,
          description: undefined,
          context_window: undefined,
          max_output_tokens: undefined,
          owned_by: undefined,
          created: undefined,
          source: apiDiscoveredIds.has(modelId) ? "discovered" : "manual",
          enabled: true,
        }];
      });
      setEnabledModelIds((prev) => [...prev, modelId]);
      setNewModelId("");
      setShowAddModelDialog(false);
    } catch (err) {
      console.error("Failed to add model:", err);
    }
  };

  const handleSetDefaultModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await setDefaultModel(modelId, selectedSurface as ModelSurface);
    } catch (err) {
      console.error("Failed to set default model:", err);
    }
  };

  // Handle delete model
  const handleDeleteModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProviderId) return;
    try {
      await disableModelForProvider(selectedProviderId, modelId);
      setEnabledModelIds((prev) => prev.filter((id) => id !== modelId));
      setModels((prev) => prev.map((model) => (
        model.id === modelId ? { ...model, enabled: false } : model
      )));
    } catch (err) {
      console.error("Failed to delete model:", err);
    }
  };

  // Get source icon and tooltip
  const getSourceInfo = (source: SettingsModel["source"]) => {
    switch (source) {
      case "discovered":
        return {
          icon: Globe,
          tooltip: t("settingsModel.sourceDiscovered"),
          className: "text-blue-500",
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
      <motion.div variants={itemVariants} className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("settingsModel.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("settingsModel.description")}
          </p>
        </div>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          variants={itemVariants}
          className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Main Content */}
      <motion.div
        variants={itemVariants}
        className="flex-1 flex gap-5 min-h-0"
      >
        {/* Left Sidebar - Provider List */}
        <div className="w-56 flex flex-col pt-1">
          <div className="px-3 pb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("settingsModel.providers")}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer"
                    onClick={openAddProviderDialog}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">{t("settingsModel.addProvider")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              {providers.length === 0 ? (
                <div className="text-center py-10 px-4 text-muted-foreground">
                  <Server className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-xs mb-3">{t("settingsModel.noProviders")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={openAddProviderDialog}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {t("settingsModel.addFirst")}
                  </Button>
                </div>
              ) : (
                providers.map((provider) => {
                  const isSelected = selectedProviderId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProviderId(provider.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer",
                        "hover:bg-muted/60",
                        isSelected
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-foreground/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          provider.enabled ? "bg-green-500" : "bg-muted-foreground/40"
                        )} />
                        <span className="font-medium text-sm truncate flex-1">
                          {provider.name}
                        </span>
                        {isSelected && (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="ml-3.5 mt-0.5 flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {PROVIDER_TYPE_LABELS[provider.provider_type]}
                        </span>
                        {provider.surfaces.length > 1 && (
                          <span className="text-[10px] text-muted-foreground/60">
                            · {t("settingsModel.surfacesCount", "{{count}} surfaces", { count: provider.surfaces.length })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Divider */}
        <div className="w-px bg-border/60 my-2" />

        {/* Right Panel - Provider Details */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/20 rounded-xl overflow-hidden">
          {selectedProvider ? (
            <>
              {/* Provider Header */}
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base truncate">{selectedProvider.name}</h3>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium flex-shrink-0">
                        {selectedProvider.category === "media" ? t("settingsModel.categoryMedia", "Media") : t("settingsModel.categoryLLM", "LLM")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {PROVIDER_TYPE_LABELS[selectedProvider.provider_type]}
                      </span>
                      {selectedProvider.base_url && (
                        <span className="text-xs text-muted-foreground/60 truncate max-w-[240px]">
                          · {selectedProvider.base_url}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                          onClick={() => openEditProviderDialog(selectedProvider)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{t("settingsModel.editProvider")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => handleDeleteProvider(selectedProvider.id, selectedProvider.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{t("settingsModel.deleteProvider")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Switch
                    checked={selectedProvider.enabled}
                    onCheckedChange={() => handleToggleProvider(selectedProvider)}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Models Section */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Surface Tabs + Model Controls */}
                <div className="px-5 py-3 border-b flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {providerSurfaces.length > 1 && (
                      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50">
                        {providerSurfaces.map((surface) => (
                          <button
                            key={surface}
                            className={cn(
                              "px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer",
                              selectedSurface === surface
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setSelectedSurface(surface)}
                          >
                            {SURFACE_LABELS[surface]}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{t("settingsModel.models")}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {enabledCount}/{totalCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder={t("settingsModel.searchModels")}
                        className="pl-7 h-7 w-40 text-xs"
                      />
                      {modelSearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full w-7 cursor-pointer"
                          onClick={() => setModelSearchQuery("")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer"
                            onClick={handleRefreshModels}
                            disabled={discoveringModels}
                          >
                            {discoveringModels ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{t("settingsModel.refreshModels")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer"
                            onClick={() => setShowAddModelDialog(true)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{t("settingsModel.addModel")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Model List */}
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {discoveringModels ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                        <p className="text-xs">{t("settingsModel.discoveringModels")}</p>
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Cpu className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">
                          {modelSearchQuery
                            ? t("settingsModel.noModelsMatchSearch")
                            : t("settingsModel.noModelsFound")}
                        </p>
                        {!modelSearchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 cursor-pointer"
                            onClick={() => setShowAddModelDialog(true)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            {t("settingsModel.addModelManually")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-px">
                        {filteredModels.map((model) => {
                          const isEnabled = model.enabled;
                          const sourceInfo = getSourceInfo(model.source);
                          const SourceIcon = sourceInfo.icon;
                          const isDefault = currentDefaultModelId === model.id;
                          return (
                            <div
                              key={model.id}
                              className={cn(
                                "group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer",
                                "hover:bg-muted/50",
                                isEnabled && "bg-primary/[0.04]",
                                !isEnabled && "opacity-60"
                              )}
                              onClick={() => handleToggleModel(model.id)}
                            >
                              {/* Model Icon */}
                              <span className="flex-shrink-0">
                                {getModelIcon(model.id, { size: 16 })}
                              </span>

                              {/* Model Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">{model.name}</span>
                                  {isDefault && (
                                    <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                                  )}
                                  {model.context_window && (
                                    <span className="text-[10px] text-muted-foreground/50 tabular-nums flex-shrink-0">
                                      {(model.context_window / 1000).toFixed(0)}K
                                    </span>
                                  )}
                                </div>
                                {model.id !== model.name && (
                                  <span className="text-[11px] text-muted-foreground/50 font-mono truncate block">
                                    {model.id}
                                  </span>
                                )}
                              </div>

                              {/* Right Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {isDefault ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-[10px] text-amber-600 font-medium">
                                          {t("settingsModel.defaultModel")}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="text-xs">{t("settingsModel.defaultModel")}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : isEnabled ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted cursor-pointer"
                                          onClick={(e) => handleSetDefaultModel(model.id, e)}
                                        >
                                          <Star className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="text-xs">{t("settingsModel.setDefault")}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null}
                                {isEnabled && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 cursor-pointer"
                                          onClick={(e) => handleDeleteModel(model.id, e)}
                                        >
                                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="text-xs">{t("settingsModel.deleteModel")}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SourceIcon className={cn("h-3 w-3 opacity-40", sourceInfo.className)} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">{sourceInfo.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {/* Toggle Switch */}
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => handleToggleModel(model.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-7 cursor-pointer [&>span]:h-3 [&>span]:w-3"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Server className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t("settingsModel.selectProvider")}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add/Edit Provider Dialog */}
      <Dialog open={showAddProviderDialog} onOpenChange={setShowAddProviderDialog}>
        <DialogContent className="sm:max-w-md">
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

          <div className="space-y-4 py-2">
            {/* Provider Name */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-name" className="text-xs font-medium">
                {t("settingsModel.providerName")}
              </Label>
              <Input
                id="provider-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settingsModel.providerNamePlaceholder")}
                className="h-9"
              />
            </div>

            {/* Provider Type */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-type" className="text-xs font-medium">
                {t("settingsModel.providerType")}
              </Label>
              <Select value={formType} onValueChange={(v) => handleTypeChange(v as ProviderType)}>
                <SelectTrigger className="h-9">
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

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("settingsModel.category")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-9 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                    formCategory === "llm"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => handleCategoryChange("llm")}
                >
                  LLM
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-9 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                    formCategory === "media"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => handleCategoryChange("media")}
                >
                  Media
                </button>
              </div>
            </div>

            {/* Surfaces */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("settingsModel.providerSurfaces")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {(formCategory === "llm" ? (["chat"] as ProviderSurface[]) : MEDIA_SURFACES).map((surface) => (
                  <button
                    key={surface}
                    type="button"
                    className={cn(
                      "h-7 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                      formSurfaces.includes(surface)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => handleSurfaceToggle(surface)}
                  >
                    {SURFACE_LABELS[surface]}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-api-key" className="text-xs font-medium">
                {t("settingsModel.apiKey")}
              </Label>
              <div className="relative">
                <Input
                  id="provider-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={t("settingsModel.apiKeyPlaceholder")}
                  className="pr-9 h-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-9 cursor-pointer"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              {formType !== "ollama" && (
                <p className="text-[11px] text-muted-foreground">
                  {t("settingsModel.apiKeyHint")}
                </p>
              )}
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-base-url" className="text-xs font-medium">
                {t("settingsModel.baseUrl")}
              </Label>
              <Input
                id="provider-base-url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URLS[formType] || t("settingsModel.baseUrlPlaceholder")}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settingsModel.baseUrlHint")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddProviderDialog(false)}
              className="cursor-pointer"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleProviderSubmit}
              disabled={!formName.trim() || formSubmitting}
              className="cursor-pointer"
            >
              {formSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingProvider ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Model Dialog */}
      <Dialog open={showAddModelDialog} onOpenChange={setShowAddModelDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settingsModel.addModel")}</DialogTitle>
            <DialogDescription>
              {t("settingsModel.addModelDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="model-id" className="text-xs font-medium">
                {t("settingsModel.modelId")}
              </Label>
              <Input
                id="model-id"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder={t("settingsModel.modelIdPlaceholder")}
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newModelId.trim()) {
                    handleAddModelManually();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settingsModel.modelIdHint")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddModelDialog(false)}
              className="cursor-pointer"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAddModelManually}
              disabled={!newModelId.trim()}
              className="cursor-pointer"
            >
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
