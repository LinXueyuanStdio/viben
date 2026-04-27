/**
 * Group chat tab content for the right sidebar
 */
import React, { useState, useEffect, useMemo } from "react";
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
  Pencil,
  Check,
  Calendar,
  LogOut,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { GroupChatMember, MemberType, MemberRole, AddMemberRequest } from "@/lib/gateway";
import type { GroupChatTabContentProps } from "./types";

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
  if (targetMemberId === currentUserId) return false;
  if (currentUserRole === "owner") return true;
  if (currentUserRole === "admin" && targetMemberRole === "member") return true;
  return false;
}

/**
 * Format date string to localized format
 */
function formatGroupChatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Editable field component for inline editing
 */
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

/**
 * Member list item for group chat
 */
interface GroupChatMemberListItemProps {
  member: GroupChatMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove?: () => void;
  isRemoving?: boolean;
}

function GroupChatMemberListItem({
  member,
  isCurrentUser,
  canRemove,
  onRemove,
  isRemoving,
}: GroupChatMemberListItemProps) {
  const { t } = useTranslation();
  const TypeIcon = getMemberTypeIcon(member.member_type);
  const RoleIcon = getRoleIcon(member.role);

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
    <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          "relative shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient()
        )}
      >
        <TypeIcon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-xs truncate">
            {member.display_name}
          </span>
          {isCurrentUser && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
              {t("common.you", "You")}
            </span>
          )}
          {RoleIcon && (
            <RoleIcon
              className={cn(
                "h-2.5 w-2.5",
                member.role === "owner" ? "text-yellow-500" : "text-blue-500"
              )}
            />
          )}
        </div>
      </div>
      {canRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserMinus className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Add member section for group chat
 */
interface AddMemberSectionProps {
  availableAgents: Array<{ id: string; name: string }>;
  existingMemberIds: string[];
  onAdd: (member: AddMemberRequest) => Promise<void>;
  isLoading?: boolean;
}

function GroupChatAddMemberSection({
  availableAgents,
  existingMemberIds,
  onAdd,
  isLoading,
}: AddMemberSectionProps) {
  const { t } = useTranslation();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

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

  if (availableAgents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        {t("groupChat.noAgentsAvailable", "No agents available")}
      </p>
    );
  }

  if (availableToAdd.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        {t("groupChat.allAgentsAdded", "All agents are already members")}
      </p>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Select
        value={selectedAgentId}
        onValueChange={setSelectedAgentId}
        disabled={isLoading || isAdding}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder={t("groupChat.selectAgent", "Select agent...")} />
        </SelectTrigger>
        <SelectContent>
          {availableToAdd.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" />
                <span className="text-xs">{agent.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!selectedAgentId || isLoading || isAdding}
        className="h-8 px-2"
      >
        {isAdding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/**
 * Group Chat tab content
 */
export function GroupChatTabContent({
  groupChat,
  members,
  availableAgents,
  currentUserId,
  currentUserRole,
  onAddMember,
  onRemoveMember,
  onUpdateGroupChat,
  onLeaveGroup,
  onDeleteGroup,
  isLoading,
}: GroupChatTabContentProps) {
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
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsLeavingOrDeleting(true);
    try {
      await onDeleteGroup();
      setIsDeleteDialogOpen(false);
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [members]);

  const existingMemberIds = members.map((m) => m.member_id);
  const isOwner = currentUserRole === "owner";

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
      <div className="space-y-4">
        {/* Group Info Section */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-md",
              getGroupAvatarGradient()
            )}
          >
            <Users className="h-6 w-6 text-white" />
          </div>
          <div className="w-full">
            <EditableField
              value={groupChat.name}
              onSave={handleUpdateName}
              placeholder={t("groupChat.namePlaceholder", "Group name")}
              className="justify-center text-base font-semibold"
              disabled={!canManageMembers(currentUserRole)}
            />
          </div>
          <div className="w-full">
            <EditableField
              value={groupChat.description || ""}
              onSave={handleUpdateDescription}
              placeholder={t("groupChat.descriptionPlaceholder", "Add a description...")}
              multiline
              className="text-xs text-muted-foreground justify-center"
              disabled={!canManageMembers(currentUserRole)}
            />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {t("groupChat.created", "Created")} {formatGroupChatDate(groupChat.created_at)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Members Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t("groupChat.members", "Members")} ({members.length})
          </h4>
          <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-[200px] overflow-y-auto">
            {sortedMembers.map((member) => (
              <GroupChatMemberListItem
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

          {/* Add Member Section */}
          {canManageMembers(currentUserRole) && (
            <div className="space-y-1.5 pt-1">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                {t("groupChat.addMembers", "Add Agent")}
              </h4>
              <GroupChatAddMemberSection
                availableAgents={availableAgents}
                existingMemberIds={existingMemberIds}
                onAdd={onAddMember}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => setIsLeaveDialogOpen(true)}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            {t("groupChat.leave", "Leave Group")}
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {t("groupChat.delete", "Delete Group")}
            </Button>
          )}
        </div>
      </div>

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
              {isLeavingOrDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
              {isLeavingOrDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("groupChat.delete", "Delete Group")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
