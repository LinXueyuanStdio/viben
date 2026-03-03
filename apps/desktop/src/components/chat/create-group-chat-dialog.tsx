/**
 * Create Group Chat Dialog
 *
 * Dialog for creating a new group chat with name, description,
 * and initial member selection (agents from the workspace).
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Users, Bot, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getExecutorIcon,
  getExecutorDisplayName,
  getExecutorAvatarGradient,
} from "@/lib/model-icons";
import type { AgentInfo } from "@/lib/gateway";
import type { MemberRole } from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

interface MemberInput {
  member_type: "human" | "agent";
  member_id: string;
  display_name: string;
  role?: MemberRole;
  model?: string;
}

interface CreateGroupChatDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Available agents to add as members */
  agents: AgentInfo[];
  /** Called when the group chat is created */
  onCreate: (data: {
    name: string;
    description?: string;
    initial_members: MemberInput[];
  }) => Promise<void>;
  /** Whether creation is in progress */
  isCreating?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CreateGroupChatDialog({
  open,
  onOpenChange,
  agents,
  onCreate,
  isCreating = false,
}: CreateGroupChatDialogProps) {
  const { t } = useTranslation();

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedAgentIds, setSelectedAgentIds] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setSelectedAgentIds(new Set());
      setError(null);
    }
  }, [open]);

  // Toggle agent selection
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  // Handle create
  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t("groupChat.errorNameRequired", "Please enter a group name"));
      return;
    }

    setError(null);

    // Build initial members from selected agents
    const initial_members: MemberInput[] = Array.from(selectedAgentIds).map((agentId) => {
      const agent = agents.find((a) => a.id === agentId);
      return {
        member_type: "agent" as const,
        member_id: agentId,
        display_name: agent?.name || agentId,
        model: agent?.model,
      };
    });

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        initial_members,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group chat");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("groupChat.createTitle", "Create Group Chat")}
          </DialogTitle>
          <DialogDescription>
            {t("groupChat.createDescription", "Create a group chat to collaborate with multiple AI agents.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">
              {t("groupChat.nameLabel", "Group Name")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder={t("groupChat.namePlaceholder", "Enter group name...")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="group-description">
              {t("groupChat.descriptionLabel", "Description")}
            </Label>
            <Textarea
              id="group-description"
              placeholder={t("groupChat.descriptionPlaceholder", "Optional description...")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label>
              {t("groupChat.selectAgentsLabel", "Add AI Agents")}
            </Label>
            <div className="border rounded-lg">
              {agents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {t("groupChat.noAgentsAvailable", "No agents available")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[240px]">
                  <div className="p-2 space-y-1">
                    {agents.map((agent) => (
                      <div
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                          selectedAgentIds.has(agent.id)
                            ? "bg-primary/10 border-2 border-primary/40 shadow-sm"
                            : "hover:bg-muted/50 border-2 border-transparent"
                        )}
                        onClick={() => toggleAgent(agent.id)}
                      >
                        <Checkbox
                          checked={selectedAgentIds.has(agent.id)}
                          onCheckedChange={() => toggleAgent(agent.id)}
                          className="pointer-events-none"
                        />
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-md",
                            getExecutorAvatarGradient(agent.executor_type)
                          )}
                        >
                          {getExecutorIcon(agent.executor_type, { size: 16 })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {agent.name}
                            </p>
                            {agent.executor_type && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                {getExecutorDisplayName(agent.executor_type)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {agent.description || (agent.executor_type ? `${getExecutorDisplayName(agent.executor_type)} executor` : "AI Agent")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            {selectedAgentIds.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("groupChat.selectedCount", "{{count}} agent(s) selected", {
                  count: selectedAgentIds.size,
                })}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.creating", "Creating...")}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {t("groupChat.createButton", "Create Group")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
