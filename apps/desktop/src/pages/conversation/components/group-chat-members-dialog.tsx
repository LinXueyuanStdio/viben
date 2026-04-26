/**
 * Group Chat Members Dialog
 *
 * Dialog to view, add, and remove members from a group chat.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  User,
  Bot,
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { GroupChatMember, MemberType, MemberRole } from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

interface GroupChatMembersDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Group chat name */
  groupChatName: string;
  /** Current members */
  members: GroupChatMember[];
  /** Current user's member ID */
  currentUserId: string;
  /** Current user's role in the group */
  currentUserRole?: MemberRole;
  /** Available agents that can be added */
  availableAgents?: Array<{ id: string; name: string }>;
  /** Called when a member is removed */
  onRemoveMember?: (memberId: string) => Promise<void>;
  /** Called when a member is added */
  onAddMember?: (member: {
    type: MemberType;
    member_id: string;
    display_name: string;
    role?: MemberRole;
    model?: string;
  }) => Promise<void>;
  /** Whether member operations are loading */
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
          "relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient()
        )}
      >
        <TypeIcon className="h-5 w-5 text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
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
                "h-3.5 w-3.5",
                member.role === "owner"
                  ? "text-yellow-500"
                  : "text-blue-500"
              )}
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {member.member_type === "human" && t("groupChat.human", "Human")}
            {member.member_type === "agent" && t("groupChat.agent", "Agent")}
          </span>
          <span className="text-muted-foreground/50">-</span>
          <span>
            {member.role === "owner" && t("groupChat.owner", "Owner")}
            {member.role === "admin" && t("groupChat.admin", "Admin")}
            {member.role === "member" && t("groupChat.member", "Member")}
          </span>
        </div>
      </div>

      {/* Remove button */}
      {canRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserMinus className="h-4 w-4" />
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
  availableAgents: Array<{ id: string; name: string; model?: string }>;
  existingMemberIds: string[];
  onAdd: (member: {
    type: MemberType;
    member_id: string;
    display_name: string;
    role?: MemberRole;
    model?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

function AddMemberSection({
  availableAgents,
  existingMemberIds,
  onAdd,
  isLoading,
}: AddMemberSectionProps) {
  const { t } = useTranslation();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [isAdding, setIsAdding] = React.useState(false);

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
      await onAdd({
        type: "agent",
        member_id: agent.id,
        display_name: agent.name,
        role: "member",
        model: agent.model,
      });
      setSelectedAgentId("");
    } finally {
      setIsAdding(false);
    }
  };

  if (availableToAdd.length === 0) {
    return null;
  }

  return (
    <div className="pt-4 border-t">
      <h4 className="text-sm font-medium mb-3">
        {t("groupChat.addMembers", "Add Members")}
      </h4>
      <div className="flex gap-2">
        <Select
          value={selectedAgentId}
          onValueChange={setSelectedAgentId}
          disabled={isLoading || isAdding}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t("chat.selectAgent", "Select agent...")} />
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
          onClick={handleAdd}
          disabled={!selectedAgentId || isLoading || isAdding}
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
// Main Component
// ============================================================================

export function GroupChatMembersDialog({
  open,
  onOpenChange,
  groupChatName,
  members,
  currentUserId,
  currentUserRole,
  availableAgents = [],
  onRemoveMember,
  onAddMember,
  isLoading,
}: GroupChatMembersDialogProps) {
  const { t } = useTranslation();
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(null);

  const handleRemoveMember = async (memberId: string) => {
    if (!onRemoveMember) return;

    setRemovingMemberId(memberId);
    try {
      await onRemoveMember(memberId);
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Sort members: owner first, then admins, then regular members
  const sortedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [members]);

  // Get existing member IDs for filtering add options
  const existingMemberIds = members.map((m) => m.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("groupChat.members", "Members")}
          </DialogTitle>
          <DialogDescription>
            {groupChatName} - {t("groupChat.memberCount", "{{count}} members", {
              count: members.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-1">
            {sortedMembers.map((member) => (
              <MemberListItem
                key={member.id}
                member={member}
                isCurrentUser={member.id === currentUserId}
                canRemove={canRemoveMember(
                  currentUserRole,
                  member.role,
                  member.id,
                  currentUserId
                )}
                onRemove={() => handleRemoveMember(member.id)}
                isRemoving={removingMemberId === member.id}
              />
            ))}
          </div>

          {/* Add member section - only for owners/admins */}
          {canManageMembers(currentUserRole) && onAddMember && (
            <AddMemberSection
              availableAgents={availableAgents}
              existingMemberIds={existingMemberIds}
              onAdd={onAddMember}
              isLoading={isLoading}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
