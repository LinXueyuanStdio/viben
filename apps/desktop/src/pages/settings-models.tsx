import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Box,
  Plus,
  Trash2,
  Star,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Cpu,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  KNOWN_MODELS,
  DEFAULT_ALIASES,
  type KnownModel,
} from "@viben/core/browser";

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

// Section header component
interface SectionHeaderProps {
  title: string;
  description?: string;
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

export function SettingsModelsPage() {
  const { t } = useTranslation();

  // State - using local state for now (will be replaced with Tauri backend calls)
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New alias form state
  const [newAliasName, setNewAliasName] = useState("");
  const [newAliasModel, setNewAliasModel] = useState("");
  const [newFallbackModel, setNewFallbackModel] = useState("");

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, KnownModel[]> = {};
    for (const model of KNOWN_MODELS) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    }
    return grouped;
  }, []);

  // Load data on mount
  // TODO: Replace with Tauri backend calls when available
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // For now, use default values since backend is not available
      // In production, this would call Tauri invoke commands
      setAliases({ ...DEFAULT_ALIASES });
      setFallbacks([]);
      setDefaultModel(KNOWN_MODELS[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultModel = async (modelId: string) => {
    try {
      // TODO: Call Tauri backend
      setDefaultModel(modelId);
    } catch (err) {
      console.error("Failed to set default model:", err);
    }
  };

  const handleAddAlias = async () => {
    if (!newAliasName.trim() || !newAliasModel) return;
    try {
      // TODO: Call Tauri backend
      setAliases((prev) => ({
        ...prev,
        [newAliasName.trim()]: newAliasModel,
      }));
      setNewAliasName("");
      setNewAliasModel("");
    } catch (err) {
      console.error("Failed to add alias:", err);
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    try {
      // TODO: Call Tauri backend
      setAliases((prev) => {
        const next = { ...prev };
        delete next[alias];
        return next;
      });
    } catch (err) {
      console.error("Failed to remove alias:", err);
    }
  };

  const handleAddFallback = async () => {
    if (!newFallbackModel || fallbacks.includes(newFallbackModel)) return;
    try {
      // TODO: Call Tauri backend
      setFallbacks((prev) => [...prev, newFallbackModel]);
      setNewFallbackModel("");
    } catch (err) {
      console.error("Failed to add fallback:", err);
    }
  };

  const handleRemoveFallback = async (model: string) => {
    try {
      // TODO: Call Tauri backend
      setFallbacks((prev) => prev.filter((m) => m !== model));
    } catch (err) {
      console.error("Failed to remove fallback:", err);
    }
  };

  const handleMoveFallback = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fallbacks.length) return;

    try {
      // TODO: Call Tauri backend
      const newFallbacks = [...fallbacks];
      [newFallbacks[index], newFallbacks[newIndex]] = [
        newFallbacks[newIndex],
        newFallbacks[index],
      ];
      setFallbacks(newFallbacks);
    } catch (err) {
      console.error("Failed to reorder fallbacks:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <motion.div
        className="p-6 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Available Models Section */}
        <motion.section variants={itemVariants}>
          <SectionHeader
            title={t("settingsModels.availableModels")}
            description={t("settingsModels.availableModelsDesc")}
          />
          <div className="space-y-4">
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <div key={provider} className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground capitalize">
                  {provider}
                </h4>
                <div className="grid gap-2">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        defaultModel === model.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{model.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {model.contextLength?.toLocaleString()} tokens
                            {model.inputPrice && model.outputPrice && (
                              <span className="ml-2">
                                ${model.inputPrice}/${model.outputPrice} per 1M
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant={defaultModel === model.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSetDefaultModel(model.id)}
                      >
                        {defaultModel === model.id ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            {t("common.default")}
                          </>
                        ) : (
                          <>
                            <Star className="h-3 w-3 mr-1" />
                            {t("settingsModels.setDefault")}
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Aliases Section */}
        <motion.section variants={itemVariants}>
          <SectionHeader
            title={t("settingsModels.aliases")}
            description={t("settingsModels.aliasesDesc")}
          />
          <div className="space-y-3">
            {/* Add new alias */}
            <div className="flex gap-2">
              <Input
                placeholder={t("settingsModels.aliasName")}
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                className="flex-1"
              />
              <Select value={newAliasModel} onValueChange={setNewAliasModel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("settingsModels.selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAddAlias}
                disabled={!newAliasName.trim() || !newAliasModel}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing aliases */}
            {Object.entries(aliases).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("settingsModels.noAliases")}
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(aliases).map(([alias, model]) => (
                  <div
                    key={alias}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <code className="text-sm font-mono">{alias}</code>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm">{model}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAlias(alias)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        {/* Fallback Chain Section */}
        <motion.section variants={itemVariants}>
          <SectionHeader
            title={t("settingsModels.fallbackChain")}
            description={t("settingsModels.fallbackChainDesc")}
          />
          <div className="space-y-3">
            {/* Add to fallback */}
            <div className="flex gap-2">
              <Select value={newFallbackModel} onValueChange={setNewFallbackModel}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("settingsModels.selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_MODELS.filter((m) => !fallbacks.includes(m.id)).map(
                    (model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAddFallback}
                disabled={!newFallbackModel}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("settingsModels.addFallback")}
              </Button>
            </div>

            {/* Fallback list */}
            {fallbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("settingsModels.noFallbacks")}
              </p>
            ) : (
              <div className="space-y-2">
                {fallbacks.map((modelId, index) => {
                  const model = KNOWN_MODELS.find((m) => m.id === modelId);
                  return (
                    <div
                      key={modelId}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium w-6 text-center">
                          {index + 1}
                        </span>
                        <span className="text-sm">
                          {model?.name || modelId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveFallback(index, "up")}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveFallback(index, "down")}
                          disabled={index === fallbacks.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFallback(modelId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </ScrollArea>
  );
}
