/**
 * Settings Providers Page
 *
 * Manages API providers for AI models using viben-core backend.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Star,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Pencil,
  Eye,
  EyeOff,
  Server,
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
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useVibenProviders,
  type ProviderType,
  DEFAULT_BASE_URLS,
  PROVIDER_TYPE_LABELS,
} from "@/hooks/use-viben-providers";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

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

// Provider type options
const PROVIDER_TYPES: ProviderType[] = [
  "openai",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "custom",
];

export function SettingsProvidersPage() {
  const { t } = useTranslation();
  const {
    providers,
    statuses,
    loading,
    error,
    testingId,
    refresh,
    createProvider,
    updateProvider,
    removeProvider,
    setDefaultProvider,
    enableProvider,
    disableProvider,
    testConnection,
  } = useVibenProviders();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ProviderType>("openai");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Open add dialog
  const openAddDialog = () => {
    setFormName("");
    setFormType("openai");
    setFormApiKey("");
    setFormBaseUrl(DEFAULT_BASE_URLS["openai"]);
    setShowApiKey(false);
    setEditingProvider(null);
    setShowAddDialog(true);
  };

  // Open edit dialog
  const openEditDialog = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setFormName(provider.name);
    setFormType(provider.provider_type);
    setFormApiKey(provider.api_key || "");
    setFormBaseUrl(provider.base_url || DEFAULT_BASE_URLS[provider.provider_type]);
    setShowApiKey(false);
    setEditingProvider(providerId);
    setShowAddDialog(true);
  };

  // Handle type change
  const handleTypeChange = (type: ProviderType) => {
    setFormType(type);
    if (!editingProvider) {
      setFormBaseUrl(DEFAULT_BASE_URLS[type]);
    }
  };

  // Handle form submit
  const handleSubmit = async () => {
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
        await createProvider({
          name: formName.trim(),
          provider_type: formType,
          api_key: formApiKey || undefined,
          base_url: formBaseUrl || DEFAULT_BASE_URLS[formType],
          set_as_default: providers.length === 0,
        });
      }
      setShowAddDialog(false);
    } catch (err) {
      console.error("Failed to save provider:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("settingsProviders.deleteConfirm", { name }))) return;
    try {
      await removeProvider(id);
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableProvider(id);
      } else {
        await disableProvider(id);
      }
    } catch (err) {
      console.error("Failed to toggle provider:", err);
    }
  };

  // Get status badge
  const getStatusBadge = (providerId: string, enabled: boolean) => {
    if (!enabled) {
      return <Badge variant="secondary">{t("common.disabled")}</Badge>;
    }
    const status = statuses[providerId];
    if (!status) {
      return <Badge variant="outline">{t("settingsProviders.unknown")}</Badge>;
    }
    if (status.connected) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("settingsProviders.connected")}
          {status.latency && <span className="ml-1 opacity-75">{status.latency}ms</span>}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" title={status.error}>
        <XCircle className="h-3 w-3 mr-1" />
        {t("settingsProviders.error")}
      </Badge>
    );
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
          {t("settingsProviders.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsProviders.description")}
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

      {/* Provider List Card */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("settingsProviders.list")}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} title={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settingsProviders.add")}
            </Button>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("settingsProviders.noProviders")}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settingsProviders.addFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200",
                  provider.is_default
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        {provider.is_default && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {PROVIDER_TYPE_LABELS[provider.provider_type]}
                        {provider.base_url && ` - ${provider.base_url}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(provider.id, provider.enabled)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => testConnection(provider.id)}
                      disabled={testingId === provider.id}
                      title={t("settingsProviders.checkStatus")}
                    >
                      {testingId === provider.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={(checked) => handleToggleEnabled(provider.id, checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {provider.enabled ? t("settingsProviders.enabled") : t("common.disabled")}
                  </span>
                  <div className="flex-1" />
                  {!provider.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultProvider(provider.id)}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      {t("settingsProviders.setDefault")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(provider.id)}
                    title={t("common.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(provider.id, provider.name)}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Provider Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider
                ? t("settingsProviders.editProvider")
                : t("settingsProviders.addProvider")}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? t("settingsProviders.editDescription")
                : t("settingsProviders.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="provider-name">{t("settingsProviders.name")}</Label>
              <Input
                id="provider-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settingsProviders.namePlaceholder")}
              />
            </div>

            {/* Provider Type */}
            <div className="space-y-2">
              <Label htmlFor="provider-type">{t("settingsProviders.type")}</Label>
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
              <Label htmlFor="provider-api-key">{t("settingsProviders.apiKey")}</Label>
              <div className="relative">
                <Input
                  id="provider-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={t("settingsProviders.apiKeyPlaceholder")}
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
                  {t("settingsProviders.apiKeyHint")}
                </p>
              )}
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="provider-base-url">{t("settingsProviders.baseUrl")}</Label>
              <Input
                id="provider-base-url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URLS[formType] || t("settingsProviders.baseUrlPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsProviders.baseUrlHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={!formName.trim() || formSubmitting}>
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingProvider ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
