import {
  Bot,
  Cpu,
  Copy,
  Check,
  ExternalLink,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { getParentDir } from "@/hooks";
import { InfoCard } from "./InfoCard";

interface SubAgentOverviewProps {
  config: {
    id: string;
    name: string;
    description: string;
    tools: string[];
    model: string;
    path: string;
    content: string;
  };
  onCopy: (text: string) => void;
  copied: boolean;
}

export function SubAgentOverview({ config, onCopy, copied }: SubAgentOverviewProps) {
  const { t } = useTranslation();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <Bot className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{config.name}</h1>
            <p className="text-muted-foreground mt-1">
              {config.description || t("settingsAgents.subagent", "SubAgent")}
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InfoCard
            icon={<Cpu className="h-4 w-4" />}
            label={t("settingsAgents.model", "Model")}
            value={config.model || "-"}
          />
          <InfoCard
            icon={<Package className="h-4 w-4" />}
            label={t("settingsAgents.tools", "Tools")}
            value={config.tools?.length ? `${config.tools.length} tools` : "-"}
          />
        </div>

        {/* Path */}
        {config.path && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("workspace.configPath", "Config Path")}</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {config.path}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onCopy(config.path)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`file://${getParentDir(config.path)}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                {t("workspace.openInFinder")}
              </a>
            </Button>
          </div>
        )}

        {/* Tools */}
        {config.tools && config.tools.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.tools", "Tools")}</h3>
            <div className="flex flex-wrap gap-2">
              {config.tools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs font-mono">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Content Preview */}
        {config.content && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.subagentContent", "SubAgent Content")}</h3>
            <div className="relative">
              <pre className="text-xs bg-muted/50 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                {config.content.slice(0, 500)}
                {config.content.length > 500 && "..."}
              </pre>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => onCopy(config.content)}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.editInFilesTab", "Select a file from the sidebar to edit the full content.")}
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
          <p className="text-xs text-muted-foreground">
            {t("settingsAgents.subagentDesc", "SubAgents are specialized agent configurations defined in .claude/agents/*.md files. They can be invoked using the Task tool to handle specific types of tasks with their own tools and context.")}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
