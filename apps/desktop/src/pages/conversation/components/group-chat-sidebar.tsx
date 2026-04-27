/**
 * Group Chat Sidebar
 *
 * A sliding panel from the right side that displays group chat details,
 * members list, sessions management, and settings.
 */

import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  User,
  Bot,
  Terminal,
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  Loader2,
  X,
  Pencil,
  Check,
  Calendar,
  LogOut,
  Trash2,
  Globe,
  FolderOpen,
  MessageSquare,
  Plus,
  Settings,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  GroupChat,
  GroupChatMember,
  GroupChatSession,
  MemberType,
  MemberRole,
  AddMemberRequest,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

interface GroupChatSidebarProps {
  /** The group chat data */
  groupChat: GroupChat;
  /** Current members of the group */
  members: GroupChatMember[];
  /** Sessions for this group chat */
  sessions?: GroupChatSession[];
  /** Currently active session ID */
  activeSessionId?: string;
  /** Available agents that can be added to the group */
  availableAgents: Array<{ id: string; name: string; model?: string }>;
  /** Current user's member ID */
  currentUserId: string;
  /** Current user's role in the group */
  currentUserRole?: MemberRole;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Called when the sidebar should close */
  onClose: () => void;
  /** Called when a member is added - uses AddMemberRequest type from gateway */
  onAddMember: (member: AddMemberRequest) => Promise<void>;
  /** Called when a member is removed */
  onRemoveMember: (memberId: string) => Promise<void>;
  /** Called when the group chat is updated */
  onUpdateGroupChat: (data: { name?: string; description?: string }) => Promise<void>;
  /** Called when the user leaves the group */
  onLeaveGroup: () => Promise<void>;
  /** Called when the group is deleted */
  onDeleteGroup: () => Promise<void>;
  /** Called when a session is selected */
  onSelectSession?: (sessionId: string) => void;
  /** Called when a new session is created */
  onCreateSession?: () => Promise<void>;
  /** Called when a session is deleted */
  onDeleteSession?: (sessionId: string) => Promise<void>;
  /** Whether operations are loading */
  isLoading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon for member type
 */
function getMemberTypeIcon(type: MemberType) {
  switch (type) {
    case "human":
      return User;
    case "agent":
      return Bot;
    case "executor":
      return Terminal;
    default:
      return User;
  }
}

/**
 * Get role icon
 */
function getRoleIcon(role: MemberRole) {
  switch (role) {
    case "owner":
      return Crown;
    case "admin":
      return Shield;
    default:
      return null;
  }
}

/**
 * Check if user can manage members
 */
function canManageMembers(role?: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Check if user can remove a specific member
 */
function canRemoveMember(
  currentUserRole?: MemberRole,
  targetMemberRole?: MemberRole,
  targetMemberId?: string,
  currentUserId?: string
): boolean {
  // Can't remove yourself
  if (targetMemberId === currentUserId) return false;
  // Owner can remove anyone except themselves
  if (currentUserRole === "owner") return true;
  // Admin can remove regular members
  if (currentUserRole === "admin" && targetMemberRole === "member") return true;
  return false;
}

/**
 * Format date string to localized format
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================================
// Editable Field Component
// ============================================================================

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

function EditableField({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  inputClassName,
  disabled = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue.trim() === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("[EditableField] Save failed:", error);
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <div className={cn("flex items-start gap-1", className)}>
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("min-h-[60px] resize-none text-sm", inputClassName)}
            autoFocus
            disabled={isSaving}
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("h-8 text-sm", inputClassName)}
            autoFocus
            disabled={isSaving}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-1 cursor-pointer rounded-md hover:bg-muted/50 transition-colors -mx-1 px-1",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span className={cn("flex-1", !value && "text-muted-foreground")}>
        {value || placeholder}
      </span>
      {!disabled && (
        <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 shrink-0 mt-0.5" />
      )}
    </div>
  );
}

// ============================================================================
// Member List Item
// ============================================================================

interface MemberListItemProps {
  member: GroupChatMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove?: () => void;
  isRemoving?: boolean;
}

function MemberListItem({
  member,
  isCurrentUser,
  canRemove,
  onRemove,
  isRemoving,
}: MemberListItemProps) {
  const { t } = useTranslation();
  const TypeIcon = getMemberTypeIcon(member.member_type);
  const RoleIcon = getRoleIcon(member.role);

  // Get avatar gradient
  const getAvatarGradient = () => {
    const colors = [
      "from-blue-500 to-cyan-400",
      "from-purple-500 to-pink-400",
      "from-green-500 to-emerald-400",
      "from-orange-500 to-yellow-400",
      "from-red-500 to-rose-400",
      "from-indigo-500 to-violet-400",
    ];
    const index = (member.display_name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient()
        )}
      >
        <TypeIcon className="h-4 w-4 text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">
            {member.display_name}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {t("common.you", "You")}
            </span>
          )}
          {RoleIcon && (
            <RoleIcon
              className={cn(
                "h-3 w-3",
                member.role === "owner"
                  ? "text-yellow-500"
                  : "text-blue-500"
              )}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">
            {member.role === "owner" && t("groupChat.owner", "Owner")}
            {member.role === "admin" && t("groupChat.admin", "Admin")}
            {member.role === "member" && t("groupChat.member", "Member")}
          </p>
          {member.member_type === "agent" && member.model && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              {member.model}
            </span>
          )}
        </div>
      </div>

      {/* Remove button */}
      {canRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserMinus className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Add Member Section
// ============================================================================

interface AddMemberSectionProps {
  availableAgents: Array<{ id: string; name: string }>;
  existingMemberIds: string[];
  onAdd: (member: AddMemberRequest) => Promise<void>;
  isLoading?: boolean;
}

function AddMemberSection({
  availableAgents,
  existingMemberIds,
  onAdd,
  isLoading,
}: AddMemberSectionProps) {
  const { t } = useTranslation();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  // Filter out agents that are already members
  const availableToAdd = availableAgents.filter(
    (agent) => !existingMemberIds.includes(agent.id)
  );

  const handleAdd = async () => {
    if (!selectedAgentId) return;

    const agent = availableAgents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    setIsAdding(true);
    try {
      const memberRequest: AddMemberRequest = {
        type: "agent",
        member_id: agent.id,
        display_name: agent.name,
        role: "member",
      };
      await onAdd(memberRequest);
      setSelectedAgentId("");
    } finally {
      setIsAdding(false);
    }
  };

  if (availableToAdd.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select
          value={selectedAgentId}
          onValueChange={setSelectedAgentId}
          disabled={isLoading || isAdding}
        >
          <SelectTrigger className="flex-1 h-9">
            <SelectValue placeholder={t("groupChat.selectAgent", "Select agent...")} />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <span>{agent.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!selectedAgentId || isLoading || isAdding}
          className="h-9"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Session List Section
// ============================================================================

interface SessionListSectionProps {
  sessions: GroupChatSession[];
  activeSessionId?: string;
  onSelect: (sessionId: string) => void;
  onCreate: () => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  isLoading?: boolean;
  canManage: boolean;
}

function SessionListSection({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
  canManage,
}: SessionListSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await onDelete(sessionId);
    } finally {
      setDeletingId(null);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-90"
            )}
          />
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">
            {t("groupChat.sessions", "Sessions")} ({sessions.length})
          </span>
        </div>
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleCreate();
            }}
            disabled={isCreating || isLoading}
          >
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-2">
        {sessions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {t("groupChat.noSessions", "No sessions yet")}
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                session.id === activeSessionId
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              )}
              onClick={() => onSelect(session.id)}
            >
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session.title || t("groupChat.defaultSessionTitle", "Session")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSessionDate(session.created_at)}
                </p>
              </div>
              {canManage && sessions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(session.id, e)}
                  disabled={deletingId === session.id}
                >
                  {deletingId === session.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Workspace Info Section
// ============================================================================

interface WorkspaceInfoProps {
  workspacePath: string;
  isGlobal: boolean;
}

function WorkspaceInfo({ workspacePath, isGlobal }: WorkspaceInfoProps) {
  const { t } = useTranslation();

  // Get displayable path (last 2 segments or full path if short)
  const displayPath = useMemo(() => {
    const parts = workspacePath.split("/").filter(Boolean);
    if (parts.length <= 2) return workspacePath;
    return ".../" + parts.slice(-2).join("/");
  }, [workspacePath]);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-lg text-xs">
      {isGlobal ? (
        <>
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">
            {t("groupChat.globalChat", "Global")}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            ~
          </Badge>
        </>
      ) : (
        <>
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground truncate" title={workspacePath}>
            {displayPath}
          </span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Settings Section
// ============================================================================

interface SettingsSectionProps {
  settings?: {
    broadcast_mode: "all" | "mention_only";
    show_thinking: boolean;
    history_limit: number;
  };
  canManage: boolean;
}

function SettingsSection({ settings, canManage: _canManage }: SettingsSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!settings) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <Settings className="h-4 w-4" />
        <span className="text-sm font-medium">
          {t("groupChat.settings", "Settings")}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2 px-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("groupChat.broadcastMode", "Broadcast")}
          </span>
          <Badge variant="outline" className="text-xs">
            {settings.broadcast_mode === "all"
              ? t("groupChat.broadcastAll", "All")
              : t("groupChat.broadcastMention", "Mentions")}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("groupChat.showThinking", "Show thinking")}
          </span>
          <Badge variant="outline" className="text-xs">
            {settings.show_thinking
              ? t("common.yes", "Yes")
              : t("common.no", "No")}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("groupChat.historyLimit", "History limit")}
          </span>
          <Badge variant="outline" className="text-xs">
            {settings.history_limit}
          </Badge>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupChatSidebar({
  groupChat,
  members,
  sessions = [],
  activeSessionId,
  availableAgents,
  currentUserId,
  currentUserRole,
  isOpen,
  onClose,
  onAddMember,
  onRemoveMember,
  onUpdateGroupChat,
  onLeaveGroup,
  onDeleteGroup,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isLoading,
}: GroupChatSidebarProps) {
  const { t } = useTranslation();
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLeavingOrDeleting, setIsLeavingOrDeleting] = useState(false);

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      await onRemoveMember(memberId);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateName = async (name: string) => {
    await onUpdateGroupChat({ name });
  };

  const handleUpdateDescription = async (description: string) => {
    await onUpdateGroupChat({ description });
  };

  const handleLeaveGroup = async () => {
    setIsLeavingOrDeleting(true);
    try {
      await onLeaveGroup();
      setIsLeaveDialogOpen(false);
      onClose();
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsLeavingOrDeleting(true);
    try {
      await onDeleteGroup();
      setIsDeleteDialogOpen(false);
      onClose();
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  // Sort members: owner first, then admins, then regular members
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [members]);

  // Get existing member IDs for filtering add options
  const existingMemberIds = members.map((m) => m.member_id);

  // Check if current user is owner (for delete permission)
  const isOwner = currentUserRole === "owner";

  // Get avatar gradient for group
  const getGroupAvatarGradient = () => {
    const colors = [
      "from-purple-500 to-pink-400",
      "from-blue-500 to-cyan-400",
      "from-green-500 to-emerald-400",
      "from-orange-500 to-yellow-400",
    ];
    const index = (groupChat.name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-80 p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("groupChat.details", "Group Details")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("groupChat.detailsDescription", "View and manage group chat settings")}
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Group Info Section */}
              <div className="flex flex-col items-center text-center space-y-3">
                {/* Group Avatar */}
                <div
                  className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-md",
                    getGroupAvatarGradient()
                  )}
                >
                  <Users className="h-8 w-8 text-white" />
                </div>

                {/* Group Name */}
                <div className="w-full">
                  <EditableField
                    value={groupChat.name}
                    onSave={handleUpdateName}
                    placeholder={t("groupChat.namePlaceholder", "Group name")}
                    className="justify-center text-lg font-semibold"
                    disabled={!canManageMembers(currentUserRole)}
                  />
                </div>

                {/* Group Description */}
                <div className="w-full">
                  <EditableField
                    value={groupChat.description || ""}
                    onSave={handleUpdateDescription}
                    placeholder={t("groupChat.descriptionPlaceholder", "Add a description...")}
                    multiline
                    className="text-sm text-muted-foreground justify-center"
                    disabled={!canManageMembers(currentUserRole)}
                  />
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {t("groupChat.created", "Created")} {formatDate(groupChat.created_at)}
                  </span>
                </div>

                {/* Workspace Info */}
                <WorkspaceInfo
                  workspacePath={groupChat.workspace_path}
                  isGlobal={groupChat.is_global}
                />
              </div>

              <Separator />

              {/* Sessions Section */}
              {onSelectSession && onCreateSession && onDeleteSession && (
                <>
                  <SessionListSection
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelect={onSelectSession}
                    onCreate={onCreateSession}
                    onDelete={onDeleteSession}
                    isLoading={isLoading}
                    canManage={canManageMembers(currentUserRole)}
                  />
                  <Separator />
                </>
              )}

              {/* Settings Section */}
              {groupChat.settings && (
                <>
                  <SettingsSection
                    settings={groupChat.settings}
                    canManage={canManageMembers(currentUserRole)}
                  />
                  <Separator />
                </>
              )}

              {/* Members Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {t("groupChat.members", "Members")} ({members.length})
                  </h4>
                </div>

                {/* Member List */}
                <div className="space-y-1">
                  {sortedMembers.map((member) => (
                    <MemberListItem
                      key={member.id}
                      member={member}
                      isCurrentUser={member.member_id === currentUserId}
                      canRemove={canRemoveMember(
                        currentUserRole,
                        member.role,
                        member.member_id,
                        currentUserId
                      )}
                      onRemove={() => handleRemoveMember(member.id)}
                      isRemoving={removingMemberId === member.id}
                    />
                  ))}
                </div>

                {/* Add Member Section - only for owners/admins */}
                {canManageMembers(currentUserRole) && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {t("groupChat.addMembers", "Add Agent")}
                      </h4>
                      <AddMemberSection
                        availableAgents={availableAgents}
                        existingMemberIds={existingMemberIds}
                        onAdd={onAddMember}
                        isLoading={isLoading}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="border-t p-4 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setIsLeaveDialogOpen(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("groupChat.leave", "Leave Group")}
            </Button>
            {isOwner && (
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("groupChat.delete", "Delete Group")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupChat.leaveConfirmTitle", "Leave Group?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "groupChat.leaveConfirmDesc",
                "Are you sure you want to leave this group? You will no longer receive messages from this group."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeavingOrDeleting}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeavingOrDeleting}
            >
              {isLeavingOrDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("groupChat.leave", "Leave Group")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupChat.deleteConfirmTitle", "Delete Group?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "groupChat.deleteConfirmDesc",
                "Are you sure you want to delete this group? This action cannot be undone and all messages will be lost."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeavingOrDeleting}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isLeavingOrDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeavingOrDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("groupChat.delete", "Delete Group")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
