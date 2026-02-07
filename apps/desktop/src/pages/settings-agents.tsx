/**
 * Settings Agents Page
 *
 * Manages AI Agents using viben-core backend.
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
  Pencil,
  Copy,
  Bot,
  FileText,
  Thermometer,
  Hash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useVibenAgents,
  type CreateAgentOptions,
} from "@/hooks/use-viben-agents";
import { useVibenProviders } from "@/hooks/use-viben-providers";
import { useVibenModels } from "@/hooks/use-viben-models";

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

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const {
    agents,
    defaultAgentId,
    templates,
    loading,
    error,
    refresh,
    createAgent,
    updateAgent,
    removeAgent,
    setDefaultAgent,
    createTemplate,
    createFromTemplate,
    refreshTemplates,
  } = useVibenAgents();

  const { providers } = useVibenProviders();
  const { models } = useVibenModels();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(4096);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Template form states
  const [templateId, setTemplateId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newAgentId, setNewAgentId] = useState("");

  // Grouped models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, typeof models> = {};
    for (const model of models) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    }
    return grouped;
  }, [models]);

  // Reset form
  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormProvider("");
    setFormModel("");
    setFormSystemPrompt("");
    setFormTemperature(0.7);
    setFormMaxTokens(4096);
    setEditingAgent(null);
  };

  // Open add dialog
  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  // Open edit dialog
  const openEditDialog = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    setFormName(agent.name);
    setFormDescription(agent.description || "");
    setFormProvider(agent.provider || "");
    setFormModel(agent.model || "");
    setFormSystemPrompt(agent.system_prompt || "");
    setFormTemperature(agent.temperature ?? 0.7);
    setFormMaxTokens(agent.max_tokens ?? 4096);
    setEditingAgent(agentId);
    setShowAddDialog(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!formName.trim()) return;

    setFormSubmitting(true);
    try {
      if (editingAgent) {
        await updateAgent(editingAgent, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          provider: formProvider || undefined,
          model: formModel || undefined,
          system_prompt: formSystemPrompt.trim() || undefined,
          temperature: formTemperature,
          max_tokens: formMaxTokens,
        });
      } else {
        const options: CreateAgentOptions = {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          provider: formProvider || undefined,
          model: formModel || undefined,
          system_prompt: formSystemPrompt.trim() || undefined,
          temperature: formTemperature,
          max_tokens: formMaxTokens,
        };
        await createAgent(options);
      }
      setShowAddDialog(false);
      resetForm();
    } catch (err) {
      console.error("Failed to save agent:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("settingsAgents.deleteConfirm", { name }))) return;
    try {
      await removeAgent(id);
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  // Handle save as template
  const handleSaveTemplate = async () => {
    if (!savingAgentId || !templateId.trim()) return;

    setFormSubmitting(true);
    try {
      await createTemplate(savingAgentId, templateId.trim());
      setShowSaveTemplateDialog(false);
      setTemplateId("");
      setSavingAgentId(null);
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle create from template
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId || !newAgentId.trim()) return;

    setFormSubmitting(true);
    try {
      await createFromTemplate(selectedTemplateId, newAgentId.trim());
      setShowTemplateDialog(false);
      setSelectedTemplateId("");
      setNewAgentId("");
    } catch (err) {
      console.error("Failed to create from template:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
          {t("settingsAgents.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsAgents.description")}
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

      {/* Agent List Card */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("settingsAgents.list")}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} title={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refreshTemplates();
                setShowTemplateDialog(true);
              }}
              disabled={templates.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t("settingsAgents.fromTemplate")}
            </Button>
            <Button variant="outline" size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settingsAgents.add")}
            </Button>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("settingsAgents.noAgents")}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settingsAgents.addFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <Collapsible
                key={agent.id}
                open={expandedAgentId === agent.id}
                onOpenChange={(open: boolean) => setExpandedAgentId(open ? agent.id : null)}
              >
                <div
                  className={cn(
                    "rounded-xl border transition-all duration-200",
                    agent.id === defaultAgentId
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{agent.name}</span>
                            {agent.id === defaultAgentId && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          {agent.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {agent.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agent.model && (
                          <Badge variant="secondary">{agent.model}</Badge>
                        )}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon">
                            {expandedAgentId === agent.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    {/* Action buttons always visible */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {t("settingsAgents.created")}: {formatDate(agent.created_at)}
                      </span>
                      <div className="flex-1" />
                      {agent.id !== defaultAgentId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultAgent(agent.id)}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          {t("settingsAgents.setDefault")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSavingAgentId(agent.id);
                          setTemplateId(agent.name.toLowerCase().replace(/\s+/g, "-"));
                          setShowSaveTemplateDialog(true);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        {t("settingsAgents.saveAsTemplate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(agent.id)}
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(agent.id, agent.name)}
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border mt-0">
                      <div className="pt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t("settingsAgents.provider")}:</span>
                          <span className="ml-2">{agent.provider || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("settingsAgents.model")}:</span>
                          <span className="ml-2">{agent.model || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{t("settingsAgents.temperature")}:</span>
                          <span className="ml-1">{agent.temperature ?? 0.7}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{t("settingsAgents.maxTokens")}:</span>
                          <span className="ml-1">{agent.max_tokens ?? 4096}</span>
                        </div>
                      </div>
                      {agent.system_prompt && (
                        <div>
                          <span className="text-sm text-muted-foreground">{t("settingsAgents.systemPrompt")}:</span>
                          <p className="mt-1 text-sm bg-muted/50 p-2 rounded-lg whitespace-pre-wrap line-clamp-3">
                            {agent.system_prompt}
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </motion.div>

      {/* Templates Section */}
      {templates.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("settingsAgents.templates")}</h3>
            <Button variant="ghost" size="icon" onClick={refreshTemplates} title={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{template.name}</span>
                  {template.description && (
                    <span className="text-xs text-muted-foreground">- {template.description}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(template.created_at)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add/Edit Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAgent
                ? t("settingsAgents.editAgent")
                : t("settingsAgents.addAgent")}
            </DialogTitle>
            <DialogDescription>
              {editingAgent
                ? t("settingsAgents.editDescription")
                : t("settingsAgents.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">{t("settingsAgents.name")} *</Label>
              <Input
                id="agent-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settingsAgents.namePlaceholder")}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="agent-description">{t("settingsAgents.descriptionLabel")}</Label>
              <Input
                id="agent-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("settingsAgents.descriptionPlaceholder")}
              />
            </div>

            {/* Provider & Model Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-provider">{t("settingsAgents.provider")}</Label>
                <Select value={formProvider} onValueChange={setFormProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("settingsAgents.selectProvider")} />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter((p) => p.enabled).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-model">{t("settingsAgents.model")}</Label>
                <Select value={formModel} onValueChange={setFormModel}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("settingsAgents.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                      <div key={provider}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          {provider}
                        </div>
                        {providerModels.filter((m) => m.enabled).map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="agent-system-prompt">{t("settingsAgents.systemPrompt")}</Label>
              <Textarea
                id="agent-system-prompt"
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                placeholder={t("settingsAgents.systemPromptPlaceholder")}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Temperature & Max Tokens Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agent-temperature">{t("settingsAgents.temperature")}</Label>
                  <span className="text-sm text-muted-foreground">{formTemperature.toFixed(2)}</span>
                </div>
                <Slider
                  id="agent-temperature"
                  value={[formTemperature]}
                  onValueChange={([value]: number[]) => setFormTemperature(value)}
                  min={0}
                  max={2}
                  step={0.01}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settingsAgents.temperatureHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-max-tokens">{t("settingsAgents.maxTokens")}</Label>
                <Input
                  id="agent-max-tokens"
                  type="number"
                  value={formMaxTokens}
                  onChange={(e) => setFormMaxTokens(parseInt(e.target.value) || 4096)}
                  min={1}
                  max={128000}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settingsAgents.maxTokensHint")}
                </p>
              </div>
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
              {editingAgent ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create from Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsAgents.createFromTemplate")}</DialogTitle>
            <DialogDescription>
              {t("settingsAgents.createFromTemplateDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("settingsAgents.selectTemplate")}</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("settingsAgents.selectTemplatePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-agent-id">{t("settingsAgents.newAgentId")}</Label>
              <Input
                id="new-agent-id"
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
                placeholder={t("settingsAgents.newAgentIdPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={!selectedTemplateId || !newAgentId.trim() || formSubmitting}
            >
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsAgents.saveAsTemplate")}</DialogTitle>
            <DialogDescription>
              {t("settingsAgents.saveAsTemplateDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-id">{t("settingsAgents.templateId")}</Label>
              <Input
                id="template-id"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder={t("settingsAgents.templateIdPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsAgents.templateIdHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateId.trim() || formSubmitting}>
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
