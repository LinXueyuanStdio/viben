import { useTranslation } from "react-i18next";
import {
  Search,
  History,
  FileText,
  Users,
  Share2,
  Loader2,
  FolderOpen,
  Globe,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/types";
import type { AgentResponse } from "@/lib/gateway";

// ============================================================================
// Search Dialog
// ============================================================================

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filteredMessages: AgentMessage[];
  currentAgentName?: string;
}

export function SearchDialog({
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  filteredMessages,
  currentAgentName,
}: SearchDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("chat.searchInConversation")}
          </DialogTitle>
          <DialogDescription>{t("chat.searchInConversationDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("chat.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          {searchQuery && (
            <div className="max-h-60 overflow-auto space-y-2">
              {filteredMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("chat.noSearchResults")}
                </p>
              ) : (
                filteredMessages.map((message, index) => (
                  <div key={index} className="p-2 rounded-lg bg-muted/50 text-sm">
                    <span className="font-medium text-xs text-muted-foreground">
                      {message.type === "user" ? t("chat.you") : currentAgentName}
                    </span>
                    <p className="truncate">{message.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// History Dialog
// ============================================================================

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: AgentMessage[];
  currentAgentName?: string;
}

export function HistoryDialog({ open, onOpenChange, messages, currentAgentName }: HistoryDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("chat.viewHistory")}
          </DialogTitle>
          <DialogDescription>{t("chat.viewHistoryDesc")}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("chat.noMessages")}
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    message.type === "user" ? "bg-primary/10 ml-8" : "bg-muted/50 mr-8"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs">
                      {message.type === "user" ? t("chat.you") : currentAgentName}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Export Dialog
// ============================================================================

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationTitle?: string;
  messageCount: number;
  onExport: () => void;
}

export function ExportDialog({ open, onOpenChange, conversationTitle, messageCount, onExport }: ExportDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("chat.exportConversation")}
          </DialogTitle>
          <DialogDescription>{t("chat.exportConversationDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-1">{conversationTitle}</p>
            <p className="text-xs text-muted-foreground">
              {messageCount} {t("chat.messagesCount")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onExport}>
              <FileText className="h-4 w-4 mr-2" />
              {t("chat.exportAsJson")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Group Dialog (Coming Soon)
// ============================================================================

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupDialog({ open, onOpenChange }: GroupDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("chat.inviteToGroup")}
          </DialogTitle>
          <DialogDescription>{t("chat.inviteToGroupDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("chat.groupFeatureComingSoon")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Share Dialog
// ============================================================================

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareText: string;
  onShare: () => void;
}

export function ShareDialog({ open, onOpenChange, shareText, onShare }: ShareDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("chat.shareConversation")}
          </DialogTitle>
          <DialogDescription>{t("chat.shareConversationDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea readOnly value={shareText} className="h-40 text-xs" />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              {t("chat.copyToClipboard")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Clear Messages Dialog
// ============================================================================

interface ClearMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
}

export function ClearMessagesDialog({ open, onOpenChange, onClear }: ClearMessagesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("chat.clearMessagesConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("chat.clearMessagesConfirmDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onClear}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("chat.clearMessages")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// Create Agent Dialog
// ============================================================================

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplate: AgentResponse | null;
  agentName: string;
  onAgentNameChange: (name: string) => void;
  agentDescription: string;
  onAgentDescriptionChange: (desc: string) => void;
  createLocation: "workspace" | "global";
  onCreateLocationChange: (loc: "workspace" | "global") => void;
  workspacePath?: string;
  globalVibenPath: string;
  isCreating: boolean;
  onCreate: () => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  selectedTemplate,
  agentName,
  onAgentNameChange,
  agentDescription,
  onAgentDescriptionChange,
  createLocation,
  onCreateLocationChange,
  workspacePath,
  globalVibenPath,
  isCreating,
  onCreate,
}: CreateAgentDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settingsAgents.addAgent", "Add Agent")}</DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? t("settingsAgents.createFromTemplateDescription", "Create a new agent from a template")
              : t("settingsAgents.addDescription", "Create a new agent")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {selectedTemplate && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <LayoutTemplate className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{selectedTemplate.name}</p>
                {selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="agent-name">{t("settingsAgents.name", "Name")}</Label>
            <Input
              id="agent-name"
              value={agentName}
              onChange={(e) => onAgentNameChange(e.target.value)}
              placeholder={t("settingsAgents.namePlaceholder", "Enter agent name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">{t("settingsAgents.descriptionLabel", "Description")}</Label>
            <Input
              id="agent-description"
              value={agentDescription}
              onChange={(e) => onAgentDescriptionChange(e.target.value)}
              placeholder={t("settingsAgents.descriptionPlaceholder", "Enter agent description")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settingsAgents.createLocation", "Location")}</Label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onCreateLocationChange("workspace")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  createLocation === "workspace"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <FolderOpen className={cn(
                  "h-5 w-5 mt-0.5 shrink-0",
                  createLocation === "workspace" ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium text-sm", createLocation === "workspace" && "text-primary")}>
                    {t("settingsAgents.workspaceLocation", "Workspace")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5" title={workspacePath ? `${workspacePath}/.viben/agents/` : ""}>
                    {workspacePath ? `${workspacePath}/.viben/agents/` : ""}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onCreateLocationChange("global")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  createLocation === "global"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Globe className={cn(
                  "h-5 w-5 mt-0.5 shrink-0",
                  createLocation === "global" ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium text-sm", createLocation === "global" && "text-primary")}>
                    {t("settingsAgents.globalLocation", "Global")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5" title={globalVibenPath}>
                    {globalVibenPath}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={onCreate} disabled={!agentName.trim() || isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("common.create", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Rename Group Chat Dialog
// ============================================================================

interface RenameGroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  onRename: () => void;
}

export function RenameGroupChatDialog({ open, onOpenChange, name, onNameChange, onRename }: RenameGroupChatDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onNameChange("");
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupChat.renameTitle", "Rename Group Chat")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              {t("groupChat.newName", "New Name")}
            </label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("groupChat.namePlaceholder", "Enter group name...")}
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { onNameChange(""); onOpenChange(false); }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={onRename} disabled={!name.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
