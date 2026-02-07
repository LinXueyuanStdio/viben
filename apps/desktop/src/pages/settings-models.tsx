/**
 * Settings Models Page
 *
 * Manages AI Models using viben-core backend.
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Star,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Cpu,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useVibenModels, type CreateModelOptions } from "@/hooks/use-viben-models";
import { type ProviderType, PROVIDER_TYPE_LABELS } from "@/hooks/use-viben-providers";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Stagger animation variants
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

// Provider types for selection
const PROVIDER_TYPES: ProviderType[] = [
  "openai",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "custom",
];

export function SettingsModelsPage() {
  const { t } = useTranslation();
  const {
    models,
    defaultModelId,
    loading,
    error,
    refresh,
    createModel,
    removeModel,
    setDefaultModel,
    enableModel,
    disableModel,
  } = useVibenModels();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form states
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState<ProviderType>("openai");
  const [formDescription, setFormDescription] = useState("");
  const [formContextWindow, setFormContextWindow] = useState(128000);
  const [formMaxOutputTokens, setFormMaxOutputTokens] = useState(4096);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Filter state
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, typeof models> = {};
    const filteredModels = providerFilter === "all"
      ? models
      : models.filter((m) => m.provider === providerFilter);

    for (const model of filteredModels) {
      const provider = model.provider || "unknown";
      if (!grouped[provider]) {
        grouped[provider] = [];
      }
      grouped[provider].push(model);
    }
    return grouped;
  }, [models, providerFilter]);

  // Get unique providers from models
  const availableProviders = useMemo(() => {
    const providers = new Set(models.map((m) => m.provider));
    return Array.from(providers);
  }, [models]);

  // Reset form
  const resetForm = () => {
    setFormId("");
    setFormName("");
    setFormProvider("openai");
    setFormDescription("");
    setFormContextWindow(128000);
    setFormMaxOutputTokens(4096);
  };

  // Open add dialog
  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!formId.trim() || !formName.trim()) return;

    setFormSubmitting(true);
    try {
      const options: CreateModelOptions = {
        id: formId.trim(),
        name: formName.trim(),
        provider: formProvider,
        description: formDescription.trim() || undefined,
        context_window: formContextWindow || undefined,
        max_output_tokens: formMaxOutputTokens || undefined,
        set_as_default: models.length === 0,
      };
      await createModel(options);
      setShowAddDialog(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create model:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("settingsModels.deleteConfirm", { name }))) return;
    try {
      await removeModel(id);
    } catch (err) {
      console.error("Failed to delete model:", err);
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableModel(id);
      } else {
        await disableModel(id);
      }
    } catch (err) {
      console.error("Failed to toggle model:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settingsModels.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsModels.description")}
        </p>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          variants={itemVariants}
          className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}

      {/* Filter & Actions Bar */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("settingsModels.filterByProvider")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("settingsModels.allProviders")}</SelectItem>
              {availableProviders.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_TYPE_LABELS[provider as ProviderType] || provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t("common.refresh")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("settingsModels.addCustomModel")}
          </Button>
        </div>
      </motion.div>

      {/* Models List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <motion.div variants={itemVariants} className="space-y-6 pr-4">
          {Object.entries(modelsByProvider).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("settingsModels.noModels")}</p>
            </div>
          ) : (
            Object.entries(modelsByProvider).map(([provider, providerModels]) => (
              <div
                key={provider}
                className="rounded-xl border bg-card p-4 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
              >
                <h3 className="text-sm font-semibold text-muted-foreground capitalize flex items-center gap-2">
                  {PROVIDER_TYPE_LABELS[provider as ProviderType] || provider}
                  <Badge variant="secondary" className="font-normal">
                    {providerModels.length}
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {providerModels.map((model) => (
                    <div
                      key={model.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
                        model.id === defaultModelId
                          ? "border-primary bg-primary/5"
                          : model.enabled
                          ? "border-transparent bg-muted/50 hover:bg-muted"
                          : "border-transparent bg-muted/30 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{model.name}</span>
                            {model.id === defaultModelId && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                            {!model.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                {t("common.disabled")}
                              </Badge>
                            )}
                            {model.created_at && (
                              <Badge variant="outline" className="text-xs">
                                {t("settingsModels.custom")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {model.context_window?.toLocaleString()} {t("settingsModels.tokens")}
                            {model.description && (
                              <span className="ml-2">- {model.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Toggle enabled */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleEnabled(model.id, !model.enabled)}
                          title={model.enabled ? t("common.disable") : t("common.enable")}
                        >
                          {model.enabled ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>

                        {/* Set default */}
                        {model.enabled && model.id !== defaultModelId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultModel(model.id)}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            {t("settingsModels.setDefault")}
                          </Button>
                        )}
                        {model.id === defaultModelId && (
                          <Badge className="bg-primary text-primary-foreground">
                            <Check className="h-3 w-3 mr-1" />
                            {t("common.default")}
                          </Badge>
                        )}

                        {/* Delete custom model */}
                        {model.created_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(model.id, model.name)}
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </motion.div>
      </ScrollArea>

      {/* Add Custom Model Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsModels.addCustomModel")}</DialogTitle>
            <DialogDescription>
              {t("settingsModels.addCustomModelDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Model ID */}
            <div className="space-y-2">
              <Label htmlFor="model-id">{t("settingsModels.modelId")} *</Label>
              <Input
                id="model-id"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder={t("settingsModels.modelIdPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsModels.modelIdHint")}
              </p>
            </div>

            {/* Model Name */}
            <div className="space-y-2">
              <Label htmlFor="model-name">{t("settingsModels.modelName")} *</Label>
              <Input
                id="model-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settingsModels.modelNamePlaceholder")}
              />
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="model-provider">{t("settingsModels.provider")}</Label>
              <Select value={formProvider} onValueChange={(v) => setFormProvider(v as ProviderType)}>
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="model-description">{t("settingsModels.descriptionLabel")}</Label>
              <Input
                id="model-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("settingsModels.descriptionPlaceholder")}
              />
            </div>

            {/* Context Window & Max Output Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model-context-window">{t("settingsModels.contextWindow")}</Label>
                <Input
                  id="model-context-window"
                  type="number"
                  value={formContextWindow}
                  onChange={(e) => setFormContextWindow(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-max-output">{t("settingsModels.maxOutputTokens")}</Label>
                <Input
                  id="model-max-output"
                  type="number"
                  value={formMaxOutputTokens}
                  onChange={(e) => setFormMaxOutputTokens(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formId.trim() || !formName.trim() || formSubmitting}
            >
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
