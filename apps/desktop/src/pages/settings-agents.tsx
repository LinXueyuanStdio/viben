/**
 * Settings Agents Page - Agent List
 *
 * Grid view of agents with:
 * - Create new agent (from template or blank)
 * - Copy/Delete actions on each card
 * - Template section
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  Bot,
  Copy,
  ChevronDown,
  Sparkles,
  Workflow,
  MessageSquare,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useVibenAgents } from "@/hooks/use-viben-agents";

// ============================================================================
// Animation Variants
// ============================================================================

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

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
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: prefersReducedMotion ? 0 : 0.3, ease: easeOutExpo },
  },
};

// ============================================================================
// Agent Templates
// ============================================================================

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "blank",
    name: "空白创建",
    description: "从零开始创建智能体",
    icon: <Plus className="h-6 w-6" />,
    color: "bg-muted",
  },
  {
    id: "general",
    name: "通用结构",
    description: "适用于多种场景的提示词结构，可以根据具体需求增删对应模块",
    icon: <Sparkles className="h-6 w-6" />,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    id: "task",
    name: "任务执行",
    description: "适用于有明确工作步骤的任务执行场景",
    icon: <Workflow className="h-6 w-6" />,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    id: "roleplay",
    name: "角色扮演",
    description: "适用于聊天场景，塑造个性化人设",
    icon: <MessageSquare className="h-6 w-6" />,
    color: "bg-green-500/10 text-green-500",
  },
  {
    id: "coding",
    name: "编程助手",
    description: "专为代码开发优化的智能体配置",
    icon: <Code2 className="h-6 w-6" />,
    color: "bg-orange-500/10 text-orange-500",
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    agents,
    defaultAgentId,
    loading,
    error,
    createAgent,
    removeAgent,
    // setDefaultAgent - will be used for "set as default" feature
  } = useVibenAgents();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Create agent from template
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreating(true);
    try {
      const newAgent = await createAgent({
        name: newAgentName.trim(),
        description: newAgentDescription.trim() || undefined,
        // TODO: Apply template settings
      });
      setShowCreateDialog(false);
      setNewAgentName("");
      setNewAgentDescription("");
      setSelectedTemplate(null);
      // Navigate to agent detail page
      navigate(`/agents/${newAgent.id}`);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setCreating(false);
    }
  };

  // Open create dialog with template
  const openCreateDialog = (template?: AgentTemplate) => {
    setSelectedTemplate(template || AGENT_TEMPLATES[0]);
    setNewAgentName(template && template.id !== "blank" ? template.name : "");
    setNewAgentDescription("");
    setShowCreateDialog(true);
  };

  // Copy agent
  const handleCopyAgent = async (_agentId: string, agentName: string) => {
    try {
      const newAgent = await createAgent({
        name: `${agentName} (副本)`,
        // TODO: Copy all settings from source agent using _agentId
      });
      navigate(`/agents/${newAgent.id}`);
    } catch (err) {
      console.error("Failed to copy agent:", err);
    }
  };

  // Delete agent
  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(t("settingsAgents.deleteConfirm", { name: agentName }))) return;
    try {
      await removeAgent(agentId);
    } catch (err) {
      console.error("Failed to delete agent:", err);
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
      className="h-full flex flex-col p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-serif">{t("settingsAgents.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settingsAgents.description")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("settingsAgents.add")}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {AGENT_TEMPLATES.map((template, index) => (
              <div key={template.id}>
                {index === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => openCreateDialog(template)}>
                  <span className={cn("mr-2 p-1 rounded", template.color)}>
                    {template.icon}
                  </span>
                  {template.name}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

      <ScrollArea className="flex-1">
        {/* My Agents Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
            {t("settingsAgents.myAgents")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                variants={itemVariants}
                className={cn(
                  "group relative p-4 rounded-xl border bg-card cursor-pointer transition-all",
                  "hover:shadow-md hover:border-primary/30",
                  agent.id === defaultAgentId && "border-primary/50"
                )}
                onClick={() => navigate(`/agents/${agent.id}`)}
              >
                {/* Default badge */}
                {agent.id === defaultAgentId && (
                  <div className="absolute top-2 right-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                )}

                {/* Avatar */}
                <Avatar className="h-16 w-16 mx-auto mb-3">
                  <AvatarFallback className="bg-primary/20 text-primary text-xl">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <h3 className="font-medium text-center truncate">{agent.name}</h3>
                {agent.description && (
                  <p className="text-xs text-muted-foreground text-center truncate mt-1">
                    {agent.description}
                  </p>
                )}

                {/* Actions (shown on hover) */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyAgent(agent.id, agent.name);
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {t("common.copy")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAgent(agent.id, agent.name);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t("common.delete")}
                  </Button>
                </div>
              </motion.div>
            ))}

            {/* Add new card */}
            <motion.div
              variants={itemVariants}
              className="p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center justify-center min-h-[160px]"
              onClick={() => openCreateDialog()}
            >
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">{t("settingsAgents.add")}</span>
            </motion.div>

            {/* Empty state */}
            {agents.length === 0 && (
              <motion.div
                variants={itemVariants}
                className="col-span-full text-center py-12 text-muted-foreground"
              >
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t("settingsAgents.noAgents")}</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Templates Section */}
        <motion.div variants={itemVariants}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
            {t("settingsAgents.templates")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {AGENT_TEMPLATES.filter((t) => t.id !== "blank").map((template) => (
              <motion.div
                key={template.id}
                variants={itemVariants}
                className="p-4 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => openCreateDialog(template)}
              >
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center mb-3 mx-auto",
                    template.color
                  )}
                >
                  {template.icon}
                </div>
                <h3 className="font-medium text-center">{template.name}</h3>
                <p className="text-xs text-muted-foreground text-center mt-1 line-clamp-2">
                  {template.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </ScrollArea>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsAgents.addAgent")}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.id !== "blank"
                ? t("settingsAgents.createFromTemplateDescription")
                : t("settingsAgents.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Template */}
            {selectedTemplate && selectedTemplate.id !== "blank" && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={cn("p-2 rounded-lg", selectedTemplate.color)}>
                  {selectedTemplate.icon}
                </div>
                <div>
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">{t("settingsAgents.name")}</Label>
              <Input
                id="agent-name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder={t("settingsAgents.namePlaceholder")}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="agent-description">{t("settingsAgents.descriptionLabel")}</Label>
              <Input
                id="agent-description"
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder={t("settingsAgents.descriptionPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateAgent} disabled={!newAgentName.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
