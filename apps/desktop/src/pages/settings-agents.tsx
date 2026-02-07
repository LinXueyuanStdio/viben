/**
 * Settings Agents Page - Agent Overview (Read-Only)
 *
 * 只读列表展示：
 * - 引导横幅，提示用户去工作空间管理智能体
 * - 执行器列表（从工作空间自动发现）
 * - 智能体列表（从 ~/.viben/agents/）
 * - 点击卡片跳转到详情页面
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Star,
  Loader2,
  AlertCircle,
  Bot,
  ArrowRight,
  Terminal,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUnifiedAgents } from "@/hooks/use-unified-agents";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import type { UnifiedAgent } from "@/types/unified-agent";

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
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: UnifiedAgent;
  isDefault?: boolean;
  onClick: () => void;
}

function AgentCard({ agent, isDefault, onClick }: AgentCardProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "group relative p-4 rounded-xl border bg-card cursor-pointer transition-all",
        "hover:shadow-md hover:border-primary/30",
        isDefault && "border-primary/50"
      )}
      onClick={onClick}
    >
      {/* Default badge */}
      {isDefault && (
        <div className="absolute top-2 right-2">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Role badge */}
      <div className="absolute top-2 left-2">
        <Badge
          variant={agent.role === "executor" ? "outline" : "default"}
          className="text-[10px] px-1.5 py-0"
        >
          {agent.role === "executor" ? (
            <Terminal className="h-2.5 w-2.5 mr-1" />
          ) : (
            <Sparkles className="h-2.5 w-2.5 mr-1" />
          )}
          {agent.role === "executor"
            ? t("settingsAgents.executors")
            : t("settingsAgents.agents")}
        </Badge>
      </div>

      {/* Avatar */}
      <Avatar className="h-16 w-16 mx-auto mb-3 mt-4">
        <AvatarFallback
          className={cn(
            "text-xl",
            agent.role === "executor"
              ? "bg-orange-500/20 text-orange-600"
              : "bg-primary/20 text-primary"
          )}
        >
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

      {/* Agent type (for workspace agents) */}
      {agent.executorType && (
        <p className="text-[10px] text-muted-foreground text-center mt-2 uppercase tracking-wider">
          {agent.executorType}
        </p>
      )}

      {/* Hover indicator */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {t("common.view")}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Get the global workspace ID for navigation
  const { workspaces } = useLocalWorkspaces();
  const globalWorkspace = workspaces.find((w) => w.type === "global");

  // Unified agents - include both executors and agents
  const {
    executors,
    agents,
    defaultAgentId,
    loading,
    error,
  } = useUnifiedAgents({
    workspaceId: globalWorkspace?.id || null,
    includeAgents: true,
    includeExecutors: true,
  });

  // Navigate to agent detail
  const handleAgentClick = (agent: UnifiedAgent) => {
    if (agent.source === "workspace" && agent.workspaceId) {
      navigate(`/workspace/${agent.workspaceId}/agent/${agent.id}`);
    } else {
      navigate(`/agents/${agent.id}`);
    }
  };

  // Navigate to workspace agents page
  const handleGoToWorkspace = () => {
    if (globalWorkspace) {
      navigate(`/workspace/${globalWorkspace.id}/agents`);
    } else {
      navigate("/mcp-services/dashboard");
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
      </motion.div>

      {/* Guidance Banner */}
      <motion.div variants={itemVariants} className="mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{t("settingsAgents.goToWorkspace")}</h3>
              <p className="text-sm text-muted-foreground">{t("settingsAgents.goToWorkspaceDesc")}</p>
            </div>
            <Button size="sm" onClick={handleGoToWorkspace} className="shrink-0">
              {t("workspace.sections.home")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
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
        {/* Executors Section (auto-discovered from workspace) */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              {t("settingsAgents.executors")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("settingsAgents.executorsDesc")}
            </p>
          </div>
          {executors.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {executors.map((item) => (
                <AgentCard
                  key={item.id}
                  agent={item}
                  isDefault={item.id === defaultAgentId}
                  onClick={() => handleAgentClick(item)}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed text-center">
              <Terminal className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("settingsAgents.noExecutors")}
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={handleGoToWorkspace}
                className="mt-2"
              >
                {t("settingsAgents.goToWorkspace")}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </motion.div>

        {/* Agents Section (from global storage) */}
        <motion.div variants={itemVariants}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("settingsAgents.agents")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("settingsAgents.agentsDesc")}
            </p>
          </div>
          {agents.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {agents.map((item) => (
                <AgentCard
                  key={item.id}
                  agent={item}
                  isDefault={item.id === defaultAgentId}
                  onClick={() => handleAgentClick(item)}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed text-center">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("settingsAgents.noAgents")}
              </p>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </motion.div>
  );
}
