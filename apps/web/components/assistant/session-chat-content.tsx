"use client";

import { useTranslation } from "react-i18next";
import type { AskUserQuestionInput } from "@viben/agent";
import { formatTokens } from "@viben/shared";
import {
  isToolUIPart,
  type FileUIPart,
  type LanguageModelUsage,
} from "ai";
import {
  Archive,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  Globe,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Share2,
  Square,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import type { ChatRefreshResponse } from "@/app/api/sessions/[sessionId]/chats/[chatId]/route";
import type { MergePullRequestResult } from "@/lib/github/actions/pr";
import {
  getDeploymentUrl,
  type PrDeploymentResponse,
} from "@/lib/github/queries/deployment";
import type { CheckRun } from "@/lib/github/pulls";
import type {
  WebAgentCommitDataPart,
  WebAgentPrDataPart,
  WebAgentSnippetDataPart,
  WebAgentUIMessage,
  WebAgentUIMessagePart,
} from "@/app/types";
import { useInlineQuestion } from "@/components/assistant/inline-question-input";
import {
  PinnedTodoPanel,
  getLatestTodos,
} from "@/components/assistant/pinned-todo-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFileSuggestions } from "@/hooks/assistant/use-file-suggestions";
import { useScrollToBottom } from "@/hooks/assistant/use-scroll-to-bottom";
import { useSessionChats } from "@/hooks/assistant/use-session-chats";
import { useSlashCommands } from "@/hooks/assistant/use-slash-commands";
import { useUserPreferences } from "@/hooks/assistant/use-user-preferences";
import {
  getGitFinalizationState,
  hasRenderableAssistantPart,
  isChatInFlight as isChatInFlightStatus,
  shouldShowThinkingIndicator,
  shouldUseChatListStreamingState,
} from "@/lib/chat-streaming-state";
import { getCurrentLanguage } from "@/lib/i18n";
import { imageAttachmentToFilePart } from "@/lib/image-utils";
import {
  type AvailableModelCost,
  DEFAULT_CONTEXT_LIMIT,
  estimateModelUsageCost,
} from "@/lib/models";
import { getPrDeploymentRefreshInterval } from "@/lib/pr-deployment-polling";

import { buildChatMessagePayload } from "@/components/assistant/chat-message-payload";
import {
  type ChatComposerHandle,
  type ChatComposerSubmit,
} from "@/components/assistant/chat-composer";
import {
  SharedChatCore,
  type SharedChatRuntime,
} from "@/components/assistant/shared-chat-core";
import { deliverStarterMessage } from "@/components/assistant/deliver-starter-message";
import {
  takeStarterMessage,
  type StarterMessageDraft,
} from "@/components/assistant/starter-message-handoff";
import { cn } from "@/lib/utils";
import {
  type SandboxInfo,
  useSessionChatMetadataContext,
  useSessionChatRuntimeContext,
  useSessionChatWorkspaceContext,
} from "@/components/assistant/session-chat-context";
import { useStreamRecovery } from "@/hooks/assistant/chat/use-stream-recovery";
import { useAutoCommitStatus } from "@/hooks/assistant/chat/use-auto-commit-status";
import { useCodeEditor } from "@/hooks/assistant/chat/use-code-editor";
import { useDevServer } from "@/hooks/assistant/chat/use-dev-server";
import { useGitPanel } from "@/components/assistant/git-panel-context";
import {
  createSandbox,
  getSandboxCreateErrorDetails,
  type SandboxCreateErrorDetails,
} from "@/lib/sandbox-create";

/** Minimum interval between textarea-focus activity pings (5 minutes). */
const ACTIVITY_PING_THROTTLE_MS = 5 * 60 * 1000;

const DiffViewer = dynamic(
  () => import("./diff-viewer").then((m) => m.DiffViewer),
  { ssr: false },
);

const MergePrDialog = dynamic(
  () =>
    import("@/components/assistant/merge-pr-dialog").then(
      (m) => m.MergePrDialog,
    ),
  { ssr: false },
);
const ClosePrDialog = dynamic(
  () =>
    import("@/components/assistant/close-pr-dialog").then(
      (m) => m.ClosePrDialog,
    ),
  { ssr: false },
);

const CreateRepoDialog = dynamic(
  () =>
    import("@/components/assistant/create-repo-dialog").then(
      (m) => m.CreateRepoDialog,
    ),
  { ssr: false },
);
const DiffTabView = dynamic(
  () => import("./diff-tab-view").then((m) => m.DiffTabView),
  { ssr: false },
);
const FileTabView = dynamic(
  () => import("./file-tab-view").then((m) => m.FileTabView),
  { ssr: false },
);
const GitPanel = dynamic(() => import("./git-panel").then((m) => m.GitPanel), {
  ssr: false,
});

// Conditionally rendered UI — only loaded when user triggers them
const FileSuggestionsDropdown = dynamic(
  () =>
    import("./file-suggestions-dropdown").then(
      (m) => m.FileSuggestionsDropdown,
    ),
  { ssr: false },
);
const SlashCommandDropdown = dynamic(
  () => import("./slash-command-dropdown").then((m) => m.SlashCommandDropdown),
  { ssr: false },
);
const SandboxCreateErrorBanner = dynamic(
  () =>
    import("./sandbox-create-error-banner").then(
      (m) => m.SandboxCreateErrorBanner,
    ),
  { ssr: false },
);
const WorkspaceFileViewer = dynamic(
  () => import("./workspace-file-viewer").then((m) => m.WorkspaceFileViewer),
  { ssr: false },
);

const emptySubscribe = () => () => {};

function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

type SandboxReadinessResult = "connected" | "no_sandbox" | "failed";

function GitDataPartCard({
  part,
}: {
  part: WebAgentCommitDataPart | WebAgentPrDataPart;
}) {
  const { t } = useTranslation();
  const isCommit = part.type === "data-commit";
  const { status } = part.data;
  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";

  const url = part.data.url;

  // Commit-specific data
  const shortSha =
    isCommit && part.data.commitSha
      ? part.data.commitSha.slice(0, 7)
      : undefined;
  const commitMessage = isCommit ? part.data.commitMessage : undefined;

  // PR-specific data
  const prNumber = !isCommit ? part.data.prNumber : undefined;

  // Determine primary label
  let label: string;
  if (isCommit) {
    if (isPending) label = t("assistant.chatContent.commitCreating");
    else if (isSuccess) {
      if (part.data.committed && part.data.pushed) {
        label = t("assistant.chatContent.commitCommittedAndPushed");
      } else if (part.data.committed) {
        label = t("assistant.chatContent.commitCommitted");
      } else if (part.data.pushed) {
        label = t("assistant.chatContent.commitPushed");
      } else {
        label = t("assistant.chatContent.commitComplete");
      }
    } else if (isError)
      label = part.data.error ?? t("assistant.chatContent.commitFailed");
    else label = t("assistant.chatContent.commitNoChanges");
  } else {
    if (isPending) label = t("assistant.chatContent.prCreating");
    else if (isSuccess) {
      if (part.data.requiresManualCreation) {
        label = t("assistant.chatContent.prReadyToCreate");
      } else if (part.data.syncedExisting && prNumber) {
        label = t("assistant.chatContent.prSyncedToExisting", { prNumber });
      } else if (prNumber) {
        label = t("assistant.chatContent.prOpened", { prNumber });
      } else {
        label = t("assistant.chatContent.prReady");
      }
    } else if (isError)
      label = part.data.error ?? t("assistant.chatContent.prFailed");
    else label = part.data.skipReason ?? t("assistant.chatContent.prSkipped");
  }

  // Build the detail fragment shown after the dot separator
  const detail = isCommit ? (shortSha ?? commitMessage) : undefined;

  // The icon shown inline in the separator
  const IconEl = isPending ? (
    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
  ) : isError ? (
    <X className="h-3 w-3 text-red-500/70" />
  ) : isCommit ? (
    <GitCommitHorizontal className="h-3 w-3 text-muted-foreground/50" />
  ) : (
    <GitPullRequest className="h-3 w-3 text-muted-foreground/50" />
  );

  // For commits with both a SHA and a message, show the message beneath
  const subtitle =
    isCommit && shortSha && commitMessage ? commitMessage : undefined;

  const textColor = isError
    ? "text-red-500/70 dark:text-red-400/70"
    : "text-muted-foreground/70";

  const Wrapper = url && !isPending ? "a" : "div";
  const wrapperProps =
    url && !isPending
      ? ({
          href: url,
          target: "_blank",
          rel: "noreferrer",
        } as const)
      : {};

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Left rule */}
      <div className="h-px flex-1 bg-border/60" />

      {/* Center label */}
      <Wrapper
        {...wrapperProps}
        className={cn(
          "group/sep flex max-w-[80%] items-center gap-1.5",
          url && !isPending && "cursor-pointer",
        )}
      >
        {IconEl}
        <span
          className={cn(
            "truncate text-xs font-medium",
            textColor,
            url &&
              !isPending &&
              "group-hover/sep:text-foreground transition-colors",
          )}
        >
          {label}
        </span>
        {detail && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span
              className={cn(
                "truncate font-mono text-[11px]",
                textColor,
                url &&
                  !isPending &&
                  "group-hover/sep:text-foreground transition-colors",
              )}
            >
              {detail}
            </span>
          </>
        )}
        {url && !isPending && (
          <ExternalLink
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors",
              "group-hover/sep:text-muted-foreground",
            )}
          />
        )}
      </Wrapper>

      {/* Right rule */}
      <div className="h-px flex-1 bg-border/60" />

      {/* Subtitle (commit message when SHA is shown as detail) */}
      {subtitle && <p className="sr-only">{subtitle}</p>}
    </div>
  );
}

function isSandboxValid(sandboxInfo: SandboxInfo | null): boolean {
  if (!sandboxInfo) return false;
  if (sandboxInfo.timeout === null) return true; // No timeout = always valid
  const expiresAt = sandboxInfo.createdAt + sandboxInfo.timeout;
  return Date.now() < expiresAt;
}

function formatUsd(amount: number): string {
  if (amount >= 100) {
    return "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (amount >= 1) {
    return (
      "$" +
      amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  if (amount >= 0.01) {
    return (
      "$" +
      amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return (
    "$" +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  );
}

type MessageUsageTotals = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

function getCachedInputTokens(usage: LanguageModelUsage | undefined): number {
  return (
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0
  );
}

function getUsageTotals(
  usage: LanguageModelUsage | undefined,
): MessageUsageTotals {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    cachedInputTokens: getCachedInputTokens(usage),
    outputTokens: usage?.outputTokens ?? 0,
  };
}

function getLatestContextUsage(
  messages: WebAgentUIMessage[],
): MessageUsageTotals {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "assistant" && message.metadata?.lastStepUsage) {
      return getUsageTotals(message.metadata.lastStepUsage);
    }
  }

  return getUsageTotals(undefined);
}

function getConversationUsage(
  messages: WebAgentUIMessage[],
): MessageUsageTotals {
  return messages.reduce<MessageUsageTotals>((total, message) => {
    if (message.role !== "assistant") {
      return total;
    }

    const usage =
      message.metadata?.totalMessageUsage ?? message.metadata?.lastStepUsage;
    if (!usage) {
      return total;
    }

    const usageTotals = getUsageTotals(usage);
    return {
      inputTokens: total.inputTokens + usageTotals.inputTokens,
      cachedInputTokens:
        total.cachedInputTokens + usageTotals.cachedInputTokens,
      outputTokens: total.outputTokens + usageTotals.outputTokens,
    };
  }, getUsageTotals(undefined));
}

type ConversationCostSource = "gateway" | "estimate" | "mixed";

type ConversationCost = {
  total: number;
  source: ConversationCostSource;
};

/**
 * Compute the cumulative USD cost across every assistant message in the
 * conversation. Per-message preference order:
 *   1. Gateway-reported `totalMessageCost` (authoritative when present).
 *   2. Token-based estimate from `totalMessageUsage` / `lastStepUsage`.
 *
 * Returns `undefined` when no cost can be attributed to any message (e.g. no
 * usage metadata and no gateway cost), matching the previous "hide the row"
 * behavior. The `source` discriminant lets the UI label the figure correctly.
 */
function getConversationCost(
  messages: WebAgentUIMessage[],
  modelCost: AvailableModelCost | undefined,
): ConversationCost | undefined {
  let total = 0;
  let hasAnyCost = false;
  let sawGateway = false;
  let sawEstimate = false;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const gatewayCost = message.metadata?.totalMessageCost;
    if (
      typeof gatewayCost === "number" &&
      Number.isFinite(gatewayCost) &&
      gatewayCost >= 0
    ) {
      total += gatewayCost;
      hasAnyCost = true;
      sawGateway = true;
      continue;
    }

    const usage =
      message.metadata?.totalMessageUsage ?? message.metadata?.lastStepUsage;
    if (!usage) {
      continue;
    }

    const estimatedCost = estimateModelUsageCost(
      getUsageTotals(usage),
      modelCost,
    );
    if (estimatedCost === undefined) {
      continue;
    }

    total += estimatedCost;
    hasAnyCost = true;
    sawEstimate = true;
  }

  if (!hasAnyCost) {
    return undefined;
  }

  const source: ConversationCostSource =
    sawGateway && sawEstimate ? "mixed" : sawGateway ? "gateway" : "estimate";

  return { total, source };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function CircularProgress({
  percentage,
  size = 16,
  strokeWidth = 2,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="text-muted-foreground"
      />
    </svg>
  );
}

function ContextUsageIndicator({
  inputTokens,
  conversationInputTokens,
  conversationCachedInputTokens,
  conversationOutputTokens,
  conversationCost,
  contextLimit,
}: {
  inputTokens: number;
  conversationInputTokens: number;
  conversationCachedInputTokens: number;
  conversationOutputTokens: number;
  conversationCost?: ConversationCost;
  contextLimit: number;
}) {
  const { t } = useTranslation();
  if (inputTokens === 0) {
    return null;
  }

  const percentage =
    contextLimit > 0 ? Math.round((inputTokens / contextLimit) * 100) : 0;
  const uncachedConversationInputTokens = Math.max(
    0,
    conversationInputTokens - conversationCachedInputTokens,
  );

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground">
          <span>{percentage}%</span>
          <CircularProgress percentage={percentage} size={14} strokeWidth={2} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="min-w-[160px] p-0">
        <div className="p-3">
          {/* Header with percentage and token count */}
          <div className="flex items-center justify-between gap-6">
            <span className="text-sm font-medium">{percentage}%</span>
            <span className="text-xs opacity-60">
              {formatTokens(inputTokens)} / {formatTokens(contextLimit)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-current opacity-10" />

        {/* Breakdown */}
        <div className="space-y-1 p-3 text-xs">
          <div className="flex justify-between gap-6">
            <span className="opacity-60">
              {t("assistant.chatContent.conversationInput")}
            </span>
            <span>{formatTokens(conversationInputTokens)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="opacity-60">
              {t("assistant.chatContent.cachedInput")}
            </span>
            <span>{formatTokens(conversationCachedInputTokens)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="opacity-60">
              {t("assistant.chatContent.uncachedInput")}
            </span>
            <span>{formatTokens(uncachedConversationInputTokens)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="opacity-60">
              {t("assistant.chatContent.conversationOutput")}
            </span>
            <span>{formatTokens(conversationOutputTokens)}</span>
          </div>
          {conversationCost !== undefined ? (
            <div className="flex justify-between gap-6">
              <span className="opacity-60">
                {conversationCost.source === "gateway"
                  ? t("assistant.chatContent.cost")
                  : conversationCost.source === "mixed"
                    ? t("assistant.chatContent.costPartialEstimate")
                    : t("assistant.chatContent.costEstimate")}
              </span>
              <span className="tabular-nums">
                {formatUsd(conversationCost.total)}
              </span>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function _SandboxHeaderBadge({
  sandboxInfo,
  isActive,
  isCreating,
  isRestoring,
  isReconnecting,
  isHibernating,
}: {
  sandboxInfo: SandboxInfo | null;
  isActive: boolean;
  isCreating: boolean;
  isRestoring: boolean;
  isReconnecting: boolean;
  isHibernating: boolean;
}) {
  const { t } = useTranslation();
  // Creating/restoring/transition state.
  if (isCreating || isRestoring || isReconnecting || isHibernating) {
    const transitionLabel = isHibernating
      ? t("assistant.chatContent.sandboxHibernating")
      : isReconnecting
        ? t("assistant.chatContent.sandboxReconnecting")
        : t("assistant.chatContent.sandboxCreating");

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center">
            <Loader2 className="size-3 animate-spin text-yellow-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {isRestoring
            ? t("assistant.chatContent.sandboxRestoring")
            : transitionLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Inactive - show gray dot
  if (!sandboxInfo || !isActive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center p-1">
            <span className="size-2.5 rounded-full bg-muted-foreground/40" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {t("assistant.chatContent.sandboxInactive")}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Active - show green dot
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center p-1">
            <span className="size-2.5 rounded-full bg-green-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {t("assistant.chatContent.sandboxActive")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function SandboxInputOverlay({
  isArchived,
  snapshotPending,
}: {
  isArchived: boolean;
  snapshotPending: boolean;
}) {
  const { t } = useTranslation();
  if (isArchived) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
        <div className="flex items-center gap-3 rounded-full bg-background/90 px-4 py-2 text-muted-foreground shadow-sm">
          <Archive className="h-4 w-4" />
          <span className="text-sm">
            {snapshotPending
              ? t("assistant.chatContent.sandboxPauseInProgress")
              : t("assistant.chatContent.sessionArchived")}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function ShareDialog({
  sessionId,
  chatId,
  initialShareId,
  externalOpen,
  onExternalOpenChange,
}: {
  sessionId: string;
  chatId: string;
  initialShareId: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [shareId, setShareId] = useState(initialShareId);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  );

  useEffect(() => {
    if (!baseUrl) {
      setBaseUrl(window.location.origin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const shareUrl = shareId && baseUrl ? `${baseUrl}/shared/${shareId}` : null;

  useEffect(() => {
    let active = true;
    setShareId(initialShareId);
    setCopied(false);
    setError(null);

    const loadShareId = async () => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/chats/${chatId}/share`,
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { shareId: string | null };
        if (!active) {
          return;
        }
        setShareId(data.shareId);
      } catch {
        // Ignore silent refresh errors in dialog state; user action still works.
      }
    };

    void loadShareId();

    return () => {
      active = false;
    };
  }, [sessionId, chatId, initialShareId]);

  async function enableSharing() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/chats/${chatId}/share`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        setError(t("assistant.chatContent.shareEnableError"));
        return;
      }
      const data = (await res.json()) as { shareId: string };
      setShareId(data.shareId);
    } catch {
      setError(t("assistant.chatContent.shareEnableError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function disableSharing() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/chats/${chatId}/share`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        setError(t("assistant.chatContent.shareDisableError"));
        return;
      }
      setShareId(null);
      setCopied(false);
    } catch {
      setError(t("assistant.chatContent.shareDisableError"));
    } finally {
      setIsLoading(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isExternallyControlled = externalOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isExternallyControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            {t("assistant.chatContent.share")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("assistant.chatContent.shareChatTitle")}</DialogTitle>
          <DialogDescription>
            {t("assistant.chatContent.shareChatDescription")}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {shareId ? (
          <>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border bg-muted px-3 py-2 text-sm">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{shareUrl}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="w-full sm:w-auto sm:shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("assistant.chatContent.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("assistant.chatContent.copyLink")}
                  </>
                )}
              </Button>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void disableSharing()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("assistant.chatContent.revokeLink")}
              </Button>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  {t("assistant.chatContent.close")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button
              onClick={() => void enableSharing()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {t("assistant.chatContent.createShareLink")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SessionChatContent({
  initialIsOnlyChatInSession,
  messageDurationMap,
  messageStartedAtMap,
  lastUserMessageSentAt,
  codeEditorDisabledReason,
}: {
  initialIsOnlyChatInSession: boolean;
  /** Pre-computed generation duration (ms) per assistant message ID */
  messageDurationMap: Record<string, number>;
  /** ISO timestamp of the preceding user message's createdAt, for live timers */
  messageStartedAtMap: Record<string, string>;
  /** Fallback: last user message's createdAt, for refresh-during-stream */
  lastUserMessageSentAt: string | null;
  codeEditorDisabledReason: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
  const [_isUnarchiving, _setIsUnarchiving] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [showDiffPanel, setShowDiffPanel] = useState(false);
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<
    string | null
  >(null);
  const [mobileArchiveDialogOpen, setMobileArchiveDialogOpen] = useState(false);
  const [mobileShareOpen, setMobileShareOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [forkingAssistantMessageId, setForkingAssistantMessageId] = useState<
    string | null
  >(null);
  const [branchPreviewUrlChangeBaseline, setBranchPreviewUrlChangeBaseline] =
    useState<string | null | undefined>(undefined);
  const hasMounted = useHasMounted();
  const {
    activeView,
    gitPanelOpen,
    shareRequested,
    setShareRequested,
    setHasActionNeeded,
    setChangesCount,
    setHasCommittedChanges,
    panelPortalRef,
    headerActionsRef,
  } = useGitPanel();
  const { preferences } = useUserPreferences();
  const isIosDevice = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }, []);
  const composerRef = useRef<ChatComposerHandle>(null);
  const isMountedRef = useRef(true);
  const lastActivityPingRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { isAtBottom, scrollToBottom } =
    useScrollToBottom<HTMLDivElement>();
  const {
    session,
    chatInfo,
    setSandboxInfo,
    archiveSession,
    unarchiveSession: _unarchiveSession,
    updateChatModel,
    updateSessionTitle,
    preferredSandboxType,
    supportsDiff,
    supportsRepoCreation,
    hasRuntimeSandboxState,
    hasSnapshot,
    setSandboxTypeFromUnknown,
    reconnectionStatus,
    lifecycleTiming,
    syncSandboxStatus,
    attemptReconnection,
    updateSessionRepo,
    updateSessionPullRequest,
    checkBranchAndPr,
    modelOptions,
    modelOptionsLoading,
  } = useSessionChatMetadataContext();
  const {
    chat,
    contextLimit,
    stopChatStream,
    retryChatStream,
    workspaceStatus,
    clearWorkspaceStatus,
    hadInitialMessages,
    initialMessages,
  } = useSessionChatRuntimeContext();
  const {
    sandboxInfo,
    diff,
    diffRefreshing,
    refreshDiff,
    gitStatus,
    gitStatusLoading,
    refreshGitStatus,
    files,
    filesLoading,
    refreshFiles,
    skills,
    skillsLoading,
    refreshSkills,
  } = useSessionChatWorkspaceContext();

  // Ping the server to refresh the inactivity timer when the user focuses
  // the textarea. Throttled to at most once every 5 minutes so we don't
  // spam the endpoint on repeated focus/blur cycles.
  const handleTextareaFocus = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityPingRef.current < ACTIVITY_PING_THROTTLE_MS) {
      return;
    }
    lastActivityPingRef.current = now;
    void fetch("/api/sandbox/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    }).catch(() => {
      // Fire-and-forget – don't block the UI on failures.
    });
  }, [session.id]);

  const autoCommitEnabled = Boolean(
    session.cloneUrl &&
    session.repoOwner &&
    session.repoName &&
    (session.autoCommitPushOverride ?? preferences?.autoCommitPush ?? false),
  );
  const { isAutoCommitting, markAutoCommitStarted } = useAutoCommitStatus(
    autoCommitEnabled,
    gitStatus,
    () => {
      void refreshGitStatus().catch(() => undefined);
      void refreshDiff().catch(() => undefined);
      void refreshFiles().catch(() => undefined);
      void checkBranchAndPr().catch(() => undefined);
    },
  );
  const {
    messages,
    error,
    clearError,
    sendMessage,
    setMessages,
    status,
    addToolApprovalResponse,
    addToolOutput,
  } = chat;
  const sharedChatRuntime = useMemo<SharedChatRuntime>(
    () => ({
      chat,
      stopChatStream,
      retryChatStream,
      workspaceStatus,
      clearWorkspaceStatus,
    }),
    [
      chat,
      clearWorkspaceStatus,
      retryChatStream,
      stopChatStream,
      workspaceStatus,
    ],
  );
  const {
    chats,
    markChatRead,
    setChatStreaming,
    setChatTitle,
    clearChatTitle,
    refreshChats,
    forkChat,
  } = useSessionChats(session.id);
  const currentChatListItem = useMemo(
    () => chats.find((candidate) => candidate.id === chatInfo.id) ?? null,
    [chatInfo.id, chats],
  );
  const handleForkAssistantMessage = useCallback(
    async (messageId: string) => {
      if (forkingAssistantMessageId !== null) {
        return;
      }

      setForkingAssistantMessageId(messageId);
      try {
        const { persisted } = forkChat(chatInfo.id, messageId);
        const forkedChat = await persisted;
        router.push(`/assistant/${session.id}/chats/${forkedChat.id}`, {
          scroll: false,
        });
      } catch (forkError) {
        console.error("Failed to fork chat:", forkError);
      } finally {
        if (isMountedRef.current) {
          setForkingAssistantMessageId((currentMessageId) =>
            currentMessageId === messageId ? null : currentMessageId,
          );
        }
      }
    },
    [chatInfo.id, forkChat, forkingAssistantMessageId, router, session.id],
  );
  const upsertSyntheticAssistantGitMessage = useCallback(
    async (message: WebAgentUIMessage) => {
      setMessages((currentMessages) => {
        const existingIndex = currentMessages.findIndex(
          (currentMessage) => currentMessage.id === message.id,
        );

        if (existingIndex < 0) {
          return [...currentMessages, message];
        }

        const nextMessages = [...currentMessages];
        nextMessages[existingIndex] = message;
        return nextMessages;
      });

      try {
        const response = await fetch(
          `/api/sessions/${session.id}/chats/${chatInfo.id}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ?? t("assistant.chatContent.persistMessageError"),
          );
        }

        await refreshChats().catch(() => undefined);
        await markChatRead(chatInfo.id).catch(() => undefined);
      } catch (error) {
        console.error(
          "Failed to persist synthetic assistant git message:",
          error,
        );
      }
    },
    [chatInfo.id, markChatRead, refreshChats, session.id, setMessages, t],
  );
  const renderMessages = useMemo(
    () => (hasMounted ? messages : initialMessages),
    [hasMounted, messages, initialMessages],
  );
  // Track explicit user-initiated stops so the UI can immediately reflect the
  // idle state even if the AI SDK `status` is stuck (common on iOS/Safari where
  // fetch abort doesn't cleanly settle the hook status).
  const [userStopped, setUserStopped] = useState(false);
  const isChatInFlight = isChatInFlightStatus(status) && !userStopped;
  const lastMessage = useMemo(
    () => renderMessages[renderMessages.length - 1],
    [renderMessages],
  );
  const gitFinalizationState = useMemo(
    () =>
      getGitFinalizationState({
        status,
        lastMessageRole: lastMessage?.role,
        lastMessageParts: lastMessage?.parts,
      }),
    [lastMessage, status],
  );
  const hasAssistantRenderableContent = useMemo(
    () =>
      lastMessage?.role === "assistant"
        ? lastMessage.parts.some(hasRenderableAssistantPart)
        : false,
    [lastMessage],
  );
  const shouldUseChatListStreaming = useMemo(
    () =>
      shouldUseChatListStreamingState({
        status,
        hasChatListStreaming: currentChatListItem?.isStreaming ?? false,
        userStopped,
        hasAssistantRenderableContent,
        lastMessageRole: lastMessage?.role,
      }),
    [
      currentChatListItem?.isStreaming,
      hasAssistantRenderableContent,
      lastMessage?.role,
      status,
      userStopped,
    ],
  );
  const hasSeenAssistantRenderableContentRef = useRef(false);
  const [hasPendingResponse, setHasPendingResponse] = useState(false);
  /** Captures Date.now() when the user sends a message, so the streaming
   *  summary bar can show an accurate live timer from the actual send time. */
  const lastSendTimestampRef = useRef<number | null>(null);

  // Ensure a stop action from one chat does not suppress the in-flight state
  // after switching to a different chat.
  useEffect(() => {
    setUserStopped(false);
  }, [chatInfo.id]);

  // Sync hasPendingResponse with the AI SDK status.
  // IMPORTANT: hasPendingResponse is intentionally excluded from the dependency
  // array. The form submit handler sets it to true optimistically (before
  // sendMessage is called), and including it here would cause the effect to
  // immediately clear it because status is still "ready" at that point —
  // resulting in a visible flicker of the thinking indicator and stop button.
  useEffect(() => {
    if (isChatInFlight || shouldUseChatListStreaming) {
      setHasPendingResponse(true);
      return;
    }

    if (status === "error" || status === "ready") {
      setHasPendingResponse(false);
      setUserStopped(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [isChatInFlight, shouldUseChatListStreaming, status]);

  useEffect(() => {
    if (!isChatInFlight && !hasPendingResponse) {
      hasSeenAssistantRenderableContentRef.current = false;
      return;
    }
    // Only mark content as "seen" once we're actually in-flight — not during
    // the optimistic pending phase where messages are still stale from the
    // previous turn (due to experimental_throttle).  Without this guard the
    // ref gets set to true from the *old* assistant message, which causes the
    // thinking indicator to disappear prematurely when the new (empty)
    // assistant message arrives.
    if (isChatInFlight && hasAssistantRenderableContent) {
      hasSeenAssistantRenderableContentRef.current = true;
    }
  }, [isChatInFlight, hasPendingResponse, hasAssistantRenderableContent]);

  const hasSeenAssistantRenderableContent =
    hasAssistantRenderableContent ||
    hasSeenAssistantRenderableContentRef.current;
  const effectiveStatus = userStopped
    ? "ready"
    : hasPendingResponse || shouldUseChatListStreaming
      ? "streaming"
      : status;
  const _isChatReady = effectiveStatus === "ready";
  const _isFinalizingGitActions = gitFinalizationState.isFinalizing;
  const showThinkingIndicator = useMemo(() => {
    // During the optimistic pending phase (user just clicked send but the
    // AI SDK status hasn't caught up yet due to throttling), always show
    // the thinking indicator.  The messages are stale at this point so
    // shouldShowThinkingIndicator would make the wrong decision based on
    // the previous turn's content.
    if (hasPendingResponse && !isChatInFlight) {
      return true;
    }
    return shouldShowThinkingIndicator({
      status: effectiveStatus,
      hasAssistantRenderableContent: hasSeenAssistantRenderableContent,
      lastMessageRole: lastMessage?.role,
    });
  }, [
    effectiveStatus,
    hasSeenAssistantRenderableContent,
    lastMessage?.role,
    hasPendingResponse,
    isChatInFlight,
  ]);
  const latestTodos = useMemo(() => getLatestTodos(messages), [messages]);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const lastStatusSyncAtRef = useRef(0);
  const statusSyncInFlightRef = useRef(false);
  const pendingOptimisticTitleChatIdRef = useRef<string | null>(null);
  const hasRequestedSessionTitleGenerationRef = useRef(false);
  const consumedStarterChatIdRef = useRef<string | null>(null);
  const markReadRef = useRef<{
    lastAt: number;
    lastChatId: string | null;
    inFlight: boolean;
  }>({
    lastAt: 0,
    lastChatId: null,
    inFlight: false,
  });
  const requestStatusSync = useCallback(
    async (mode: "normal" | "force" = "normal"): Promise<void> => {
      const now = Date.now();
      if (statusSyncInFlightRef.current) return;
      if (mode === "normal" && now - lastStatusSyncAtRef.current < 5_000) {
        return;
      }

      statusSyncInFlightRef.current = true;
      try {
        await syncSandboxStatus();
        lastStatusSyncAtRef.current = Date.now();
      } finally {
        statusSyncInFlightRef.current = false;
      }
    },
    [syncSandboxStatus],
  );

  const requestMarkChatRead = useCallback(
    async (mode: "normal" | "force" = "normal"): Promise<void> => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      // For passive/background-triggered marks, require focus too.
      // Force marks run on route entry/turn completion and should not wait for
      // focus when the tab is already visible.
      if (
        mode === "normal" &&
        typeof document !== "undefined" &&
        !document.hasFocus()
      ) {
        return;
      }

      const now = Date.now();
      const isSameChat = markReadRef.current.lastChatId === chatInfo.id;
      if (markReadRef.current.inFlight) return;
      if (
        mode === "normal" &&
        isSameChat &&
        now - markReadRef.current.lastAt < 3_000
      ) {
        return;
      }

      markReadRef.current.inFlight = true;
      try {
        await markChatRead(chatInfo.id);
        markReadRef.current.lastAt = Date.now();
        markReadRef.current.lastChatId = chatInfo.id;
      } catch (err) {
        console.error("Failed to mark chat read:", err);
      } finally {
        markReadRef.current.inFlight = false;
      }
    },
    [chatInfo.id, markChatRead],
  );
  const requestMarkChatReadRef = useRef(requestMarkChatRead);
  const tabResumeRefreshRef = useRef({
    pending: false,
    inFlight: false,
    lastAt: 0,
  });
  const shouldSkipServerSnapshotOverwriteRef = useRef(false);
  const sandboxActionReadyPromiseRef = useRef<Promise<boolean> | null>(null);

  const refreshCurrentChatSnapshot = useCallback(async (): Promise<void> => {
    if (shouldSkipServerSnapshotOverwriteRef.current) {
      return;
    }

    const response = await fetch(
      `/api/sessions/${session.id}/chats/${chatInfo.id}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ChatRefreshResponse;
    if (data.isStreaming) {
      return;
    }

    clearError();
    setMessages(data.messages);
  }, [chatInfo.id, clearError, session.id, setMessages]);

  const refreshAfterTabResume = useCallback(async (): Promise<void> => {
    if (
      typeof document !== "undefined" &&
      (document.visibilityState !== "visible" || !document.hasFocus())
    ) {
      return;
    }

    tabResumeRefreshRef.current.pending = false;

    const now = Date.now();
    if (tabResumeRefreshRef.current.inFlight) {
      return;
    }
    if (now - tabResumeRefreshRef.current.lastAt < 3_000) {
      return;
    }

    tabResumeRefreshRef.current.inFlight = true;
    try {
      await Promise.allSettled([
        requestStatusSync("force"),
        refreshCurrentChatSnapshot(),
        refreshChats(),
        refreshGitStatus(),
        refreshDiff(),
        refreshFiles(),
        refreshSkills(),
        checkBranchAndPr(),
      ]);
    } finally {
      tabResumeRefreshRef.current.lastAt = Date.now();
      tabResumeRefreshRef.current.inFlight = false;
    }
  }, [
    checkBranchAndPr,
    refreshChats,
    refreshCurrentChatSnapshot,
    refreshDiff,
    refreshFiles,
    refreshGitStatus,
    refreshSkills,
    requestStatusSync,
  ]);

  useEffect(() => {
    requestMarkChatReadRef.current = requestMarkChatRead;
  }, [requestMarkChatRead]);

  useEffect(() => {
    hasRequestedSessionTitleGenerationRef.current = false;
  }, [session.id]);

  // Refresh chats list when the first message completes to pick up the auto-generated title
  useEffect(() => {
    if (
      !hadInitialMessages &&
      status === "ready" &&
      messages.some((m) => m.role === "assistant")
    ) {
      refreshChats();
    }
  }, [hadInitialMessages, status, messages, refreshChats]);

  useEffect(() => {
    void requestMarkChatReadRef.current("force");
  }, [chatInfo.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        tabResumeRefreshRef.current.pending = true;
        return;
      }

      void requestMarkChatRead("normal");
      if (!tabResumeRefreshRef.current.pending) {
        return;
      }

      void refreshAfterTabResume();
    };
    const handleWindowBlur = () => {
      tabResumeRefreshRef.current.pending = true;
    };
    const handleWindowFocus = () => {
      void requestMarkChatRead("normal");
      if (!tabResumeRefreshRef.current.pending) {
        return;
      }

      void refreshAfterTabResume();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [refreshAfterTabResume, requestMarkChatRead]);

  useStreamRecovery({
    sessionId: session.id,
    chatId: chatInfo.id,
    status,
    isChatInFlight,
    hasAssistantRenderableContent,
    retryChatStream,
  });

  const handleModelChange = useCallback(
    async (modelId: string) => {
      if (!modelId || modelId === chatInfo.modelId) return;
      try {
        setIsUpdatingModel(true);
        await updateChatModel(modelId);
      } catch (err) {
        console.error("Failed to update chat model:", err);
      } finally {
        setIsUpdatingModel(false);
      }
    },
    [chatInfo.modelId, updateChatModel],
  );

  const selectedModelOption = useMemo(
    () => modelOptions.find((option) => option.id === chatInfo.modelId),
    [modelOptions, chatInfo.modelId],
  );

  const handleFileSelect = (
    value: string,
    mentionStart: number,
    cursorPos: number,
  ) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(cursorPos);
    const newInput = `${before}@${value} ${after}`;
    setInput(newInput);
    // Move cursor to after the inserted value + space
    const newCursorPos = mentionStart + value.length + 2; // @ + value + space
    setCursorPosition(newCursorPos);
    // Focus input and set cursor position after React renders
    setTimeout(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const {
    showSuggestions,
    suggestions,
    selectedIndex,
    handleKeyDown: handleSuggestionsKeyDown,
    mentionInfo,
  } = useFileSuggestions({
    inputValue: input,
    cursorPosition,
    files,
    onSelect: handleFileSelect,
  });

  const handleSlashCommandSelect = (
    skillName: string,
    slashStart: number,
    cursorPos: number,
  ) => {
    const before = input.slice(0, slashStart);
    const after = input.slice(cursorPos);
    const newInput = `${before}/${skillName} ${after}`;
    setInput(newInput);
    const newCursorPos = slashStart + skillName.length + 2; // / + name + space
    setCursorPosition(newCursorPos);
    setTimeout(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const {
    showSlashCommands,
    slashSuggestions,
    selectedSlashIndex,
    handleSlashKeyDown,
    slashInfo,
  } = useSlashCommands({
    inputValue: input,
    cursorPosition,
    skills,
    onSelect: handleSlashCommandSelect,
  });

  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [sandboxCreateError, setSandboxCreateError] =
    useState<SandboxCreateErrorDetails | null>(null);
  const [deleteMessageError, setDeleteMessageError] = useState<string | null>(
    null,
  );
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [resendingMessageId, setResendingMessageId] = useState<string | null>(
    null,
  );

  const hasMessageActionInFlight =
    deletingMessageId !== null || resendingMessageId !== null || isChatInFlight;

  shouldSkipServerSnapshotOverwriteRef.current =
    hasPendingResponse ||
    deletingMessageId !== null ||
    resendingMessageId !== null;

  const sendMessageWithPendingState = useCallback(
    async (message: Parameters<typeof sendMessage>[0]) => {
      setHasPendingResponse(true);
      setUserStopped(false);
      lastSendTimestampRef.current = Date.now();
      hasSeenAssistantRenderableContentRef.current = false;
      void setChatStreaming(chatInfo.id, true);

      try {
        await sendMessage(message);
      } catch (error) {
        setHasPendingResponse(false);
        void setChatStreaming(chatInfo.id, false);
        throw error;
      }
    },
    [chatInfo.id, sendMessage, setChatStreaming],
  );

  const handleFixChecks = useCallback(
    async (failedRuns: CheckRun[]) => {
      const names = failedRuns.map((run) => run.name).join(", ");
      const fallbackPrompt = `# Fix Failing Checks\n\nThe following checks are failing: ${names}. Please investigate and push a fix.`;
      let messagePayload: Parameters<typeof sendMessageWithPendingState>[0] = {
        text: fallbackPrompt,
      };

      try {
        const res = await fetch(`/api/sessions/${session.id}/checks/fix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkRuns: failedRuns }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            prompt?: string;
            snippets?: Array<{ filename: string; content: string }>;
            message?: string;
          };
          const prompt = data.prompt?.trim() || data.message?.trim();
          const snippets = Array.isArray(data.snippets) ? data.snippets : [];

          if (prompt && snippets.length > 0) {
            messagePayload = {
              parts: [
                {
                  type: "text" as const,
                  text: prompt,
                },
                ...snippets.map((snippet, index) => ({
                  type: "data-snippet" as const,
                  id: `fix-check-${index}`,
                  data: snippet,
                })),
              ],
            };
          } else if (prompt) {
            messagePayload = { text: prompt };
          }
        }
      } catch {
        // Fall through to fallback
      }

      await sendMessageWithPendingState(messagePayload);
    },
    [sendMessageWithPendingState, session.id],
  );

  const handleFixConflicts = useCallback(
    async (baseBranchRef: string, closeMergeDialog = false) => {
      if (closeMergeDialog) {
        setMergeDialogOpen(false);
      }

      await sendMessageWithPendingState({
        text: `# Resolve Merge Conflicts\n\nThere is a merge conflict with ${baseBranchRef}. Fetch and then fix the conflicts. Do not rebase.`,
      });
    },
    [sendMessageWithPendingState],
  );

  const handleDeleteUserMessage = useCallback(
    async (messageId: string) => {
      if (hasMessageActionInFlight) {
        return;
      }

      const targetMessageIndex = messages.findIndex(
        (message) => message.id === messageId,
      );
      if (
        targetMessageIndex < 0 ||
        messages[targetMessageIndex]?.role !== "user"
      ) {
        return;
      }

      const confirmed = window.confirm(
        t("assistant.chatContent.deleteMessageConfirm"),
      );
      if (!confirmed) {
        return;
      }

      setDeleteMessageError(null);
      setDeletingMessageId(messageId);

      try {
        const response = await fetch(
          `/api/sessions/${session.id}/chats/${chatInfo.id}/messages/${messageId}`,
          { method: "DELETE" },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          success?: boolean;
        };

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? t("assistant.chatContent.deleteMessageError"),
          );
        }

        setMessages(messages.slice(0, targetMessageIndex));
        await refreshChats();
      } catch (err) {
        console.error("Failed to delete message:", err);
        setDeleteMessageError(
          err instanceof Error
            ? err.message
            : t("assistant.chatContent.deleteMessageError"),
        );
      } finally {
        setDeletingMessageId(null);
      }
    },
    [
      hasMessageActionInFlight,
      messages,
      session.id,
      chatInfo.id,
      setMessages,
      refreshChats,
      t,
    ],
  );

  const handleResendUserMessage = useCallback(
    async (messageId: string) => {
      if (hasMessageActionInFlight) {
        return;
      }

      const targetMessageIndex = messages.findIndex(
        (message) => message.id === messageId,
      );
      const targetMessage = messages[targetMessageIndex];
      if (!targetMessage || targetMessage.role !== "user") {
        return;
      }

      const resendTextParts = targetMessage.parts
        .filter(
          (part): part is Extract<WebAgentUIMessagePart, { type: "text" }> =>
            part.type === "text",
        )
        .map((part) => ({
          type: "text" as const,
          text: part.text,
        }));
      const resendText = resendTextParts.map((part) => part.text).join("");
      const resendFiles = targetMessage.parts
        .filter((part): part is FileUIPart => part.type === "file")
        .map((part) => ({
          type: "file" as const,
          mediaType: part.mediaType,
          url: part.url,
          ...(part.filename ? { filename: part.filename } : {}),
        }));
      const resendSnippets = targetMessage.parts
        .filter(
          (part): part is WebAgentSnippetDataPart =>
            part.type === "data-snippet",
        )
        .map((part) => ({
          type: "data-snippet" as const,
          id: part.id,
          data: {
            content: part.data.content,
            filename: part.data.filename,
          },
        }));

      if (
        !resendText.trim() &&
        resendFiles.length === 0 &&
        resendSnippets.length === 0
      ) {
        return;
      }

      const confirmed = window.confirm(
        t("assistant.chatContent.resendMessageConfirm"),
      );
      if (!confirmed) {
        return;
      }

      setDeleteMessageError(null);
      setResendingMessageId(messageId);

      try {
        const response = await fetch(
          `/api/sessions/${session.id}/chats/${chatInfo.id}/messages/${messageId}`,
          { method: "DELETE" },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          success?: boolean;
        };

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? t("assistant.chatContent.resendMessageError"),
          );
        }

        setMessages(messages.slice(0, targetMessageIndex));
        await sendMessageWithPendingState(
          resendSnippets.length > 0
            ? {
                parts: [...resendTextParts, ...resendFiles, ...resendSnippets],
              }
            : {
                text: resendText,
                files: resendFiles.length > 0 ? resendFiles : undefined,
              },
        );

        await refreshChats();
      } catch (err) {
        console.error("Failed to resend message:", err);
        setDeleteMessageError(
          err instanceof Error
            ? err.message
            : t("assistant.chatContent.resendMessageError"),
        );
      } finally {
        setResendingMessageId(null);
      }
    },
    [
      hasMessageActionInFlight,
      messages,
      session.id,
      chatInfo.id,
      setMessages,
      sendMessageWithPendingState,
      refreshChats,
      t,
    ],
  );

  const waitForSandboxReady = useCallback(
    async (maxAttempts = 8): Promise<boolean> => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await attemptReconnection();
        if (result === "connected") {
          return true;
        }

        // Keep lifecycle timing fresh during restore retries, but do not treat
        // DB-only "active" as fully ready until reconnect confirms connectivity.
        await syncSandboxStatus();
        if (attempt < maxAttempts) {
          await sleep(attempt * 350);
        }
      }
      return false;
    },
    [attemptReconnection, syncSandboxStatus],
  );

  const checkSandboxReadiness =
    useCallback(async (): Promise<SandboxReadinessResult> => {
      const result = await attemptReconnection();
      if (result === "connected" || result === "no_sandbox") {
        return result;
      }

      await syncSandboxStatus();
      return "failed";
    }, [attemptReconnection, syncSandboxStatus]);

  const refreshWorkspaceAfterRestore = useCallback(async () => {
    await requestStatusSync("force").catch(() => undefined);
    await Promise.all([
      refreshGitStatus().catch(() => undefined),
      refreshDiff().catch(() => undefined),
      refreshFiles().catch(() => undefined),
      checkBranchAndPr().catch(() => undefined),
    ]);
  }, [
    requestStatusSync,
    refreshGitStatus,
    refreshDiff,
    refreshFiles,
    checkBranchAndPr,
  ]);

  const _handleRestoreSnapshot = useCallback(async () => {
    setIsRestoringSnapshot(true);
    setRestoreError(null);

    try {
      // Resume through the compatibility endpoint. This resumes the named
      // persistent sandbox when available, or lazily migrates a legacy snapshot.
      const response = await fetch("/api/sandbox/snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        alreadyRunning?: boolean;
      };

      if (!response.ok) {
        const errorMsg =
          payload.error ?? t("assistant.chatContent.unknownError");

        // If a sandbox is already running (for example after a lifecycle
        // restore), reconnect instead of surfacing a blocking error.
        if (errorMsg.includes("sandbox is still running")) {
          shouldRefreshRestoredWorkspaceRef.current = true;
          const reconnected = await waitForSandboxReady();
          if (!reconnected) {
            setRestoreError(t("assistant.chatContent.sandboxAlreadyRunning"));
          }
          return;
        }

        shouldRefreshRestoredWorkspaceRef.current = false;
        setRestoreError(
          t("assistant.chatContent.sandboxResumeFailed", { errorMsg }),
        );
        return;
      }

      if (payload.alreadyRunning) {
        shouldRefreshRestoredWorkspaceRef.current = true;
        const reconnected = await waitForSandboxReady();
        if (!reconnected) {
          setRestoreError(t("assistant.chatContent.sandboxAlreadyRunning"));
        }
        return;
      }

      // Keep preferred sandbox mode aligned with the preserved session state.
      setSandboxTypeFromUnknown(session.sandboxState?.type);
      shouldRefreshRestoredWorkspaceRef.current = true;

      // Refresh local timeout/connection data from server state.
      const reconnected = await waitForSandboxReady();
      if (!reconnected) {
        setRestoreError(
          t("assistant.chatContent.sandboxResumedReconnectPending"),
        );
      }
    } catch (err) {
      shouldRefreshRestoredWorkspaceRef.current = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      setRestoreError(
        t("assistant.chatContent.sandboxResumeError", { errorMsg }),
      );
    } finally {
      setIsRestoringSnapshot(false);
    }
  }, [
    session.id,
    session.sandboxState,
    setSandboxTypeFromUnknown,
    waitForSandboxReady,
    t,
  ]);

  const _handleCreateNewSandbox = useCallback(async () => {
    setIsCreatingSandbox(true);
    setSandboxCreateError(null);

    try {
      const branchExistsOnOrigin = session.prNumber != null;
      const shouldCreateNewBranch =
        session.isNewBranch && !branchExistsOnOrigin;
      const newSandbox = await createSandbox(
        session.cloneUrl ?? undefined,
        session.branch ?? undefined,
        shouldCreateNewBranch,
        session.id,
        preferredSandboxType,
      );
      setSandboxInfo(newSandbox);
      setSandboxTypeFromUnknown(newSandbox.type);
      setSandboxCreateError(null);
      void requestStatusSync("force");
    } catch (err) {
      const details = getSandboxCreateErrorDetails(err);
      setSandboxCreateError(details);
      console.error("Failed to create sandbox:", err);
    } finally {
      setIsCreatingSandbox(false);
    }
  }, [
    session.prNumber,
    session.isNewBranch,
    session.cloneUrl,
    session.branch,
    session.id,
    preferredSandboxType,
    setSandboxInfo,
    setSandboxTypeFromUnknown,
    requestStatusSync,
  ]);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (!isChatInFlight) {
      composerRef.current?.focus();
    }
  }, [isChatInFlight]);

  // After a chat turn completes, immediately sync state from the server.
  // Auto-commit itself runs server-side so it still happens when this page is
  // not open; the client just reconciles git, diff, and PR state.
  // Initialize to null (not `status`) so the first render always reconciles.
  // When navigating back to a chat whose stream finished in the background,
  // status is already "ready" but the optimistic streaming overlay may still
  // be set. Starting from null makes `becameReady` true on mount, which clears
  // the stale overlay immediately.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const wasStreaming = prevStatus === "streaming";
    const wasSubmitted = prevStatus === "submitted";
    const becameReady = status === "ready" && prevStatus !== "ready";
    const becameError = status === "error" && prevStatus !== "error";
    const shouldClearStreaming = status === "error" || becameReady;
    prevStatusRef.current = status;

    // Skip clearing the streaming overlay during unmount. Route teardown aborts
    // local transport connections, which can still trigger a transient status
    // transition before React finishes unmounting. Clearing here would remove
    // the optimistic streaming badge even though the server-side stream may
    // still be running. SWR polling + overlay reconciliation clear it once the
    // server confirms the stream has actually ended.
    if (shouldClearStreaming && isMountedRef.current) {
      void setChatStreaming(chatInfo.id, false);
    }
    if (becameError && pendingOptimisticTitleChatIdRef.current) {
      void clearChatTitle(pendingOptimisticTitleChatIdRef.current);
      pendingOptimisticTitleChatIdRef.current = null;
    }
    if (becameReady) {
      pendingOptimisticTitleChatIdRef.current = null;
    }

    let followUpTimeout: ReturnType<typeof setTimeout> | null = null;
    if (
      (wasStreaming || wasSubmitted) &&
      status === "ready" &&
      isMountedRef.current
    ) {
      if (!userStopped) {
        markAutoCommitStarted();
      }

      const refreshCompletedTurnState = async () => {
        await requestStatusSync("force").catch(() => undefined);
        await refreshGitStatus().catch(() => undefined);
        await refreshDiff().catch(() => undefined);
        await refreshFiles().catch(() => undefined);
        await checkBranchAndPr().catch(() => undefined);
      };

      void refreshCompletedTurnState();
      void requestMarkChatRead("force");
      void refreshChats();

      if (session.cloneUrl && session.repoOwner && session.repoName) {
        followUpTimeout = setTimeout(() => {
          void refreshCompletedTurnState();
        }, 3000);
      }
    }

    return () => {
      if (followUpTimeout !== null) {
        clearTimeout(followUpTimeout);
      }
    };
  }, [
    status,
    chatInfo.id,
    setChatStreaming,
    clearChatTitle,
    requestStatusSync,
    refreshGitStatus,
    refreshDiff,
    refreshFiles,
    checkBranchAndPr,
    requestMarkChatRead,
    refreshChats,
    session.cloneUrl,
    session.repoOwner,
    session.repoName,
    markAutoCommitStarted,
    userStopped,
  ]);

  const shouldRefreshRestoredWorkspaceRef = useRef(false);

  const isArchived = session.status === "archived";

  // After a snapshot restore, wait for the live workspace hooks to be active
  // again before forcing refreshes. Calling the pre-restore callbacks inside
  // the async restore handler can be a no-op because they were created while
  // the sandbox was still offline.
  useEffect(() => {
    if (!shouldRefreshRestoredWorkspaceRef.current) {
      return;
    }
    if (!sandboxInfo || reconnectionStatus !== "connected") {
      return;
    }

    shouldRefreshRestoredWorkspaceRef.current = false;
    void refreshWorkspaceAfterRestore();
  }, [sandboxInfo, reconnectionStatus, refreshWorkspaceAfterRestore]);

  // Attempt a single reconnect probe on entry to pick up authoritative server state
  // (connected sandbox, no sandbox, and snapshot availability).
  // Skip for archived sessions -- they should never spin up a sandbox.
  useEffect(() => {
    if (isArchived) return;
    if (
      !sandboxInfo &&
      !isCreatingSandbox &&
      !isRestoringSnapshot &&
      reconnectionStatus === "idle"
    ) {
      void attemptReconnection();
    }
  }, [
    isArchived,
    sandboxInfo,
    isCreatingSandbox,
    isRestoringSnapshot,
    reconnectionStatus,
    attemptReconnection,
  ]);

  // Server-authoritative lifecycle state: lightweight status poll every 15s.
  useEffect(() => {
    if (isCreatingSandbox || isRestoringSnapshot) return;

    const poll = () => {
      if (reconnectionStatus === "checking") return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void requestStatusSync("normal");
    };

    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [
    isCreatingSandbox,
    isRestoringSnapshot,
    reconnectionStatus,
    requestStatusSync,
  ]);

  // Track tool completions to trigger diff refresh
  const prevToolStatesRef = useRef<Map<string, string>>(new Map());
  const hasInitializedToolStatesRef = useRef(false);

  // Extract current tool states from messages
  const currentToolStates = useMemo(() => {
    const states = new Map<string, string>();
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (isToolUIPart(part)) {
          states.set(part.toolCallId, part.state);
        }
      }
    }
    return states;
  }, [messages]);

  useEffect(() => {
    if (!hasInitializedToolStatesRef.current) {
      prevToolStatesRef.current = currentToolStates;
      hasInitializedToolStatesRef.current = true;
      return;
    }

    let hasFileChange = false;
    const fileModifyingTools = ["tool-write", "tool-edit"];

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;

        const toolId = part.toolCallId;
        const toolState = part.state;
        const prevState = prevToolStatesRef.current.get(toolId);
        const isFileModifyingTool = fileModifyingTools.includes(part.type);
        const justCompleted =
          toolState === "output-available" && prevState !== "output-available";

        if (isFileModifyingTool && justCompleted) {
          hasFileChange = true;
        }
      }
    }

    prevToolStatesRef.current = currentToolStates;

    if (hasFileChange) {
      // Refresh diff and files when files change.
      // Fire-and-forget with error handling - SWR updates error state internally,
      // but we catch here to prevent unhandled rejection warnings.
      refreshDiff().catch(() => {});
      refreshGitStatus().catch(() => {});
      refreshFiles().catch(() => {});
    }
  }, [
    currentToolStates,
    messages,
    refreshDiff,
    refreshGitStatus,
    refreshFiles,
  ]);

  // Note: SWR handles automatic fetching when sandbox becomes available
  // and caching/deduplication of requests

  const tokenUsage = useMemo(
    () => getLatestContextUsage(renderMessages),
    [renderMessages],
  );
  const conversationUsage = useMemo(
    () => getConversationUsage(renderMessages),
    [renderMessages],
  );
  const conversationCost = useMemo(
    () => getConversationCost(renderMessages, selectedModelOption?.cost),
    [renderMessages, selectedModelOption?.cost],
  );

  // Detect pending AskUserQuestion tool calls
  const { hasPendingQuestion, pendingQuestionPart, questionToolCallId } =
    useMemo(() => {
      const lastMessage = renderMessages[renderMessages.length - 1];
      if (lastMessage?.role === "assistant") {
        for (const p of lastMessage.parts) {
          if (
            isToolUIPart(p) &&
            p.type === "tool-ask_user_question" &&
            p.state === "input-available"
          ) {
            return {
              hasPendingQuestion: true,
              pendingQuestionPart: p as {
                type: "tool-ask_user_question";
                toolCallId: string;
                input: AskUserQuestionInput;
              },
              questionToolCallId: p.toolCallId,
            };
          }
        }
      }
      return {
        hasPendingQuestion: false,
        pendingQuestionPart: null,
        questionToolCallId: null,
      };
    }, [renderMessages]);

  // Handle question submission
  const handleQuestionSubmit = useCallback(
    (answers: Record<string, string | string[]>) => {
      if (questionToolCallId) {
        addToolOutput({
          tool: "ask_user_question",
          toolCallId: questionToolCallId,
          output: { answers },
        });
      }
    },
    [questionToolCallId, addToolOutput],
  );

  // Handle question cancellation
  const handleQuestionCancel = useCallback(() => {
    if (questionToolCallId) {
      addToolOutput({
        tool: "ask_user_question",
        toolCallId: questionToolCallId,
        output: { declined: true },
      });
    }
  }, [questionToolCallId, addToolOutput]);

  // Stable empty array so the hook doesn't reset on every render when there's no question
  const emptyQuestions = useMemo(
    () => [] as AskUserQuestionInput["questions"],
    [],
  );

  const inlineQuestion = useInlineQuestion({
    questions:
      hasPendingQuestion && pendingQuestionPart
        ? pendingQuestionPart.input.questions
        : emptyQuestions,
    onSubmit: handleQuestionSubmit,
    onCancel: handleQuestionCancel,
    textareaValue: input,
    onTextareaChange: setInput,
  });

  // Inline question UI is integrated into the prompt box on all viewports
  const showInlineQuestion = inlineQuestion.isActive;

  const isReconnectingSandbox =
    reconnectionStatus === "checking" &&
    !sandboxInfo &&
    !isCreatingSandbox &&
    !isRestoringSnapshot;
  const isHibernatingTransition =
    isReconnectingSandbox && hasSnapshot && !hasRuntimeSandboxState;
  const isArchiveSnapshotPending = isArchived && hasRuntimeSandboxState;
  const isServerHibernating = lifecycleTiming.state === "hibernating";
  const isServerRestoring = lifecycleTiming.state === "restoring";
  const isServerHibernated = lifecycleTiming.state === "hibernated";
  const isHibernatingUi = isHibernatingTransition || isServerHibernating;

  // Sandbox is active only when BOTH the local connection info is valid AND
  // the server agrees the lifecycle is active (not hibernating/hibernated/failed).
  const serverSaysActive =
    lifecycleTiming.state === null ||
    lifecycleTiming.state === "active" ||
    lifecycleTiming.state === "provisioning";
  const isSandboxActive = isSandboxValid(sandboxInfo) && serverSaysActive;

  const _sandboxUiStatus = useMemo(() => {
    if (isArchived) {
      return {
        label: t("assistant.chatContent.statusArchived"),
        className: "bg-muted text-muted-foreground",
      };
    }
    if (isCreatingSandbox) {
      return {
        label: t("assistant.chatContent.statusCreating"),
        className: "bg-amber-500/15 text-amber-700",
      };
    }
    if (isRestoringSnapshot || isServerRestoring) {
      return {
        label: t("assistant.chatContent.statusRestoring"),
        className: "bg-amber-500/15 text-amber-700",
      };
    }
    if (isHibernatingUi) {
      return {
        label: t("assistant.chatContent.statusHibernating"),
        className: "bg-amber-500/15 text-amber-700",
      };
    }
    if (isReconnectingSandbox) {
      return {
        label: t("assistant.chatContent.statusReconnecting"),
        className: "bg-amber-500/15 text-amber-700",
      };
    }
    // Server says hibernated — show Paused regardless of local sandboxInfo
    if (isServerHibernated && hasSnapshot) {
      return {
        label: t("assistant.chatContent.statusPaused"),
        className: "bg-muted text-muted-foreground",
      };
    }
    if (isSandboxActive) {
      return {
        label: t("assistant.chatContent.statusActive"),
        className: "bg-emerald-500/15 text-emerald-700",
      };
    }
    if (hasSnapshot) {
      return {
        label: t("assistant.chatContent.statusPaused"),
        className: "bg-muted text-muted-foreground",
      };
    }
    if (reconnectionStatus === "failed") {
      return {
        label: t("assistant.chatContent.statusConnectionIssue"),
        className: "bg-destructive/10 text-destructive",
      };
    }
    return {
      label: t("assistant.chatContent.statusNoSandbox"),
      className: "bg-muted text-muted-foreground",
    };
  }, [
    t,
    isArchived,
    isCreatingSandbox,
    isRestoringSnapshot,
    isServerRestoring,
    isHibernatingUi,
    isReconnectingSandbox,
    isServerHibernated,
    hasSnapshot,
    isSandboxActive,
    reconnectionStatus,
  ]);
  const canRunDevServer =
    !isArchived &&
    isSandboxActive &&
    !isCreatingSandbox &&
    !isRestoringSnapshot &&
    !isReconnectingSandbox &&
    !isHibernatingUi;
  const canUseSandboxActions = !isArchived;
  const canUseCodeEditor = codeEditorDisabledReason === null;
  const ensureSandboxReadyForAction =
    useCallback(async (): Promise<boolean> => {
      if (isSandboxActive) {
        return true;
      }

      if (isArchived) {
        return false;
      }

      if (sandboxActionReadyPromiseRef.current) {
        return sandboxActionReadyPromiseRef.current;
      }

      const readyPromise = (async () => {
        if (isCreatingSandbox || isRestoringSnapshot) {
          return waitForSandboxReady(12);
        }

        if (isReconnectingSandbox) {
          const readiness = await checkSandboxReadiness();
          if (readiness === "connected") {
            return true;
          }
          if (readiness === "failed") {
            return false;
          }
        }

        if (hasSnapshot || hasRuntimeSandboxState || isHibernatingUi) {
          await _handleRestoreSnapshot();
        } else {
          await _handleCreateNewSandbox();
        }

        return waitForSandboxReady(12);
      })();

      sandboxActionReadyPromiseRef.current = readyPromise;
      try {
        return await readyPromise;
      } finally {
        sandboxActionReadyPromiseRef.current = null;
      }
    }, [
      _handleCreateNewSandbox,
      _handleRestoreSnapshot,
      checkSandboxReadiness,
      hasRuntimeSandboxState,
      hasSnapshot,
      isArchived,
      isCreatingSandbox,
      isHibernatingUi,
      isReconnectingSandbox,
      isRestoringSnapshot,
      isSandboxActive,
      waitForSandboxReady,
    ]);
  const devServer = useDevServer({
    sessionId: session.id,
    canRun: canRunDevServer,
    ensureSandboxReady: ensureSandboxReadyForAction,
  });
  const codeEditor = useCodeEditor({
    sessionId: session.id,
    canRun: canRunDevServer && canUseCodeEditor,
    ensureSandboxReady: ensureSandboxReadyForAction,
  });
  const isCodeEditorActionDisabled =
    !canUseCodeEditor ||
    codeEditor.state.status === "starting" ||
    codeEditor.state.status === "stopping";

  const hasRepo = Boolean(session.cloneUrl);
  const hasExistingPr = session.prNumber != null;
  const previewLookupBranch =
    gitStatus?.branch && gitStatus.branch !== "HEAD"
      ? gitStatus.branch
      : session.branch;
  const hasBranchPreviewLookup = Boolean(
    session.vercelProjectId && previewLookupBranch,
  );
  const existingPrUrl =
    hasExistingPr && session.repoOwner && session.repoName
      ? `https://github.com/${session.repoOwner}/${session.repoName}/pull/${session.prNumber}`
      : null;
  const prDeploymentQuery = new URLSearchParams(
    Object.entries({
      ...(hasExistingPr ? { prNumber: String(session.prNumber) } : {}),
      ...(previewLookupBranch ? { branch: previewLookupBranch } : {}),
    }),
  ).toString();
  const { data: prDeploymentData, mutate: refreshPrDeployment } =
    useSWR<PrDeploymentResponse>(
      hasExistingPr || hasBranchPreviewLookup
        ? `/api/sessions/${session.id}/pr-deployment${
            prDeploymentQuery ? `?${prDeploymentQuery}` : ""
          }`
        : null,
      async () =>
        getDeploymentUrl({
          sessionId: session.id,
          ...(hasExistingPr && session.prNumber
            ? { prNumber: session.prNumber }
            : {}),
          ...(previewLookupBranch ? { branch: previewLookupBranch } : {}),
        }),
      {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        // Poll while we're still waiting for the first deployment, or while a
        // branch preview is rolling forward to a newer deployment after a push.
        refreshInterval: (latestData) =>
          getPrDeploymentRefreshInterval({
            shouldPoll: hasExistingPr || hasBranchPreviewLookup,
            deploymentUrl: latestData?.deploymentUrl,
            documentHasFocus:
              typeof document === "undefined" ? true : document.hasFocus(),
            waitForDeploymentUrlChangeFrom: branchPreviewUrlChangeBaseline,
          }),
        shouldRetryOnError: false,
      },
    );
  const prDeploymentUrl = prDeploymentData?.deploymentUrl ?? null;
  const buildingDeploymentUrl = prDeploymentData?.buildingDeploymentUrl ?? null;
  const failedDeploymentUrl = prDeploymentData?.failedDeploymentUrl ?? null;

  useEffect(() => {
    if (!hasExistingPr && !hasBranchPreviewLookup) {
      if (branchPreviewUrlChangeBaseline !== undefined) {
        setBranchPreviewUrlChangeBaseline(undefined);
      }
      return;
    }

    if (branchPreviewUrlChangeBaseline === undefined) {
      return;
    }

    if (prDeploymentUrl !== branchPreviewUrlChangeBaseline) {
      setBranchPreviewUrlChangeBaseline(undefined);
    }
  }, [
    hasExistingPr,
    hasBranchPreviewLookup,
    branchPreviewUrlChangeBaseline,
    prDeploymentUrl,
  ]);

  const isDeploymentStale = branchPreviewUrlChangeBaseline !== undefined;
  const isDeploymentFailed =
    !prDeploymentUrl &&
    !buildingDeploymentUrl &&
    !hasExistingPr &&
    Boolean(failedDeploymentUrl);
  const previewDeploymentTargetUrl =
    (isDeploymentStale ? buildingDeploymentUrl : null) ??
    prDeploymentUrl ??
    (isDeploymentFailed ? failedDeploymentUrl : null);
  const showHeaderActions =
    canUseSandboxActions || Boolean(previewDeploymentTargetUrl);

  // When auto-commit lands (transitions from committing to clean), mark the
  // current preview deployment as stale so the UI shows "Deploying…" until
  // the new Vercel build finishes.
  const prevIsAutoCommittingRef = useRef(isAutoCommitting);
  useEffect(() => {
    const wasAutoCommitting = prevIsAutoCommittingRef.current;
    prevIsAutoCommittingRef.current = isAutoCommitting;

    if (
      wasAutoCommitting &&
      !isAutoCommitting &&
      (hasExistingPr || hasBranchPreviewLookup)
    ) {
      setBranchPreviewUrlChangeBaseline(prDeploymentUrl);
      refreshPrDeployment().catch(() => undefined);
    }
  }, [
    isAutoCommitting,
    hasExistingPr,
    hasBranchPreviewLookup,
    prDeploymentUrl,
    refreshPrDeployment,
  ]);

  const hasUncommittedGitChanges = gitStatus?.hasUncommittedChanges ?? false;
  const hasUnpushedCommits = gitStatus?.hasUnpushedCommits ?? false;
  const showCommitAction =
    hasRepo &&
    (hasUncommittedGitChanges || (hasExistingPr && hasUnpushedCommits));

  // Sync the "action needed" indicator for the right sidebar toggle button
  useEffect(() => {
    setHasActionNeeded(showCommitAction);
  }, [showCommitAction, setHasActionNeeded]);

  // Sync the file change count for the badge on the toggle button
  const totalChangesCount = diff?.files?.length ?? 0;
  useEffect(() => {
    setChangesCount(totalChangesCount);
  }, [totalChangesCount, setChangesCount]);

  // Sync the "committed changes" indicator (blue dot) — branch has committed
  // changes, no PR created yet, and no uncommitted changes to deal with
  useEffect(() => {
    setHasCommittedChanges(
      hasRepo &&
        totalChangesCount > 0 &&
        !hasExistingPr &&
        !hasUncommittedGitChanges,
    );
  }, [
    hasRepo,
    totalChangesCount,
    hasExistingPr,
    hasUncommittedGitChanges,
    setHasCommittedChanges,
  ]);
  const hasOpenPr = hasExistingPr && session.prStatus === "open";
  const canCloseAndArchive = hasOpenPr && !isArchived;
  const handleCommitted = useCallback(async () => {
    if (hasExistingPr || hasBranchPreviewLookup) {
      setBranchPreviewUrlChangeBaseline(prDeploymentUrl);
    }

    await Promise.all([
      refreshGitStatus().catch(() => undefined),
      refreshDiff().catch(() => undefined),
      refreshFiles().catch(() => undefined),
      checkBranchAndPr().catch(() => undefined),
    ]);

    if (hasExistingPr || hasBranchPreviewLookup) {
      await refreshPrDeployment().catch(() => undefined);
    }
  }, [
    hasExistingPr,
    hasBranchPreviewLookup,
    prDeploymentUrl,
    refreshGitStatus,
    refreshDiff,
    refreshFiles,
    checkBranchAndPr,
    refreshPrDeployment,
  ]);

  const handleMerged = useCallback(
    async (mergeResult: MergePullRequestResult) => {
      updateSessionPullRequest({
        prNumber: mergeResult.prNumber,
        prStatus: "merged",
      });

      if (mergeResult.branchDeleteError) {
        console.warn(
          "PR merged but source branch was not deleted:",
          mergeResult.branchDeleteError,
        );
      }

      try {
        await archiveSession();
        router.push("/sessions");
      } catch (archiveError) {
        const archiveMessage =
          archiveError instanceof Error
            ? archiveError.message
            : t("assistant.chatContent.archiveSessionError");
        throw new Error(
          t("assistant.chatContent.archiveAfterMergeError", {
            archiveMessage,
          }),
          {
            cause: archiveError,
          },
        );
      }
    },
    [archiveSession, router, updateSessionPullRequest, t],
  );

  const handleClosed = useCallback(
    async (closeResult: { closed: boolean; prNumber: number }) => {
      updateSessionPullRequest({
        prNumber: closeResult.prNumber,
        prStatus: "closed",
      });

      try {
        await archiveSession();
        router.push("/sessions");
      } catch (archiveError) {
        const archiveMessage =
          archiveError instanceof Error
            ? archiveError.message
            : t("assistant.chatContent.archiveSessionError");
        throw new Error(
          t("assistant.chatContent.archiveAfterCloseError", {
            archiveMessage,
          }),
          {
            cause: archiveError,
          },
        );
      }
    },
    [archiveSession, router, updateSessionPullRequest, t],
  );

  const prepareFirstMessageTitle = useCallback(
    (messageText: string) => {
      const shouldSetOptimisticTitle =
        initialIsOnlyChatInSession &&
        !hadInitialMessages &&
        messages.length === 0;
      const trimmedText = messageText.trim();
      const shouldGenerateSessionTitle =
        shouldSetOptimisticTitle &&
        trimmedText.length > 0 &&
        !hasRequestedSessionTitleGenerationRef.current;

      if (!shouldSetOptimisticTitle || trimmedText.length === 0) return;

      const nextTitle =
        trimmedText.length > 80
          ? trimmedText.slice(0, 80) + "..."
          : trimmedText;
      pendingOptimisticTitleChatIdRef.current = chatInfo.id;
      void setChatTitle(chatInfo.id, nextTitle);

      if (!shouldGenerateSessionTitle) return;

      hasRequestedSessionTitleGenerationRef.current = true;
      const generatedTitlePromise = fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedText,
          language: getCurrentLanguage(),
        }),
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const data = (await response.json().catch(() => null)) as {
            title?: unknown;
          } | null;
          if (typeof data?.title !== "string") return null;
          const title = data.title.trim();
          return title.length > 0 ? title : null;
        })
        .catch(() => null);

      void generatedTitlePromise
        .then((generatedTitle) => {
          if (!generatedTitle) return;
          return updateSessionTitle(generatedTitle);
        })
        .catch(() => {
          // Keep the optimistic title when generation persistence fails.
        });
    },
    [
      chatInfo.id,
      hadInitialMessages,
      initialIsOnlyChatInSession,
      messages.length,
      setChatTitle,
      updateSessionTitle,
    ],
  );

  const rollbackOptimisticTitle = useCallback(() => {
    if (!pendingOptimisticTitleChatIdRef.current) return;
    void clearChatTitle(pendingOptimisticTitleChatIdRef.current);
    pendingOptimisticTitleChatIdRef.current = null;
  }, [clearChatTitle]);

  const handleComposerSubmit = useCallback(
    async (draft: ChatComposerSubmit) => {
      if (
        showInlineQuestion ||
        isArchived ||
        isChatInFlight ||
        hasPendingResponse
      ) {
        return;
      }
      if (
        !draft.text.trim() &&
        draft.images.length === 0 &&
        draft.textAttachments.length === 0
      ) {
        return;
      }

      const messageText = draft.text;
      const messagePayload = buildChatMessagePayload({
        text: messageText,
        files: draft.images.map((image, index): FileUIPart => {
          const extension = image.mediaType.split("/")[1] ?? "png";
          return {
            type: "file",
            filename: image.filename ?? `image-${index + 1}.${extension}`,
            mediaType: image.mediaType,
            url: image.url,
          };
        }),
        textAttachments: draft.textAttachments.map((attachment) => ({
          id: nanoid(),
          filename: attachment.filename,
          content: attachment.content,
          lineCount: attachment.content.split("\n").length,
          byteSize: new Blob([attachment.content]).size,
        })),
      });

      prepareFirstMessageTitle(messageText);

      try {
        await sendMessageWithPendingState(messagePayload);
      } catch (error) {
        rollbackOptimisticTitle();
        console.error("Failed to send message:", error);
        throw error;
      }
    },
    [
      hasPendingResponse,
      isArchived,
      isChatInFlight,
      prepareFirstMessageTitle,
      rollbackOptimisticTitle,
      sendMessageWithPendingState,
      showInlineQuestion,
    ],
  );

  const sendStarterDraft = useCallback(
    async (draft: StarterMessageDraft) => {
      const messagePayload = buildChatMessagePayload({
        text: draft.text,
        files: draft.images.map(imageAttachmentToFilePart),
        textAttachments: draft.textAttachments,
      });
      prepareFirstMessageTitle(draft.text);

      try {
        await sendMessageWithPendingState(messagePayload);
      } catch (error) {
        rollbackOptimisticTitle();
        throw error;
      }
    },
    [
      prepareFirstMessageTitle,
      rollbackOptimisticTitle,
      sendMessageWithPendingState,
    ],
  );

  useEffect(() => {
    if (consumedStarterChatIdRef.current === chatInfo.id) return;

    const draft = takeStarterMessage(chatInfo.id);
    if (!draft) return;
    consumedStarterChatIdRef.current = chatInfo.id;

    void deliverStarterMessage({
      draft,
      currentModelId: chatInfo.modelId,
      updateModel: async (modelId) => {
        setIsUpdatingModel(true);
        try {
          await updateChatModel(modelId);
        } finally {
          setIsUpdatingModel(false);
        }
      },
      sendDraft: sendStarterDraft,
      restoreDraft: (failedDraft) => {
        setInput(failedDraft.text);
        composerRef.current?.addImageAttachments(failedDraft.images);
        composerRef.current?.addTextAttachments(failedDraft.textAttachments);
      },
    });
  }, [
    chatInfo.id,
    chatInfo.modelId,
    sendStarterDraft,
    updateChatModel,
  ]);

  // Stable callbacks for the chat transcript so message-level `React.memo` can
  // skip re-rendering historical messages while the latest one is streaming.
  const handleTranscriptFork = useCallback(
    (message: WebAgentUIMessage) => {
      void handleForkAssistantMessage(message.id);
    },
    [handleForkAssistantMessage],
  );
  const handleTranscriptOpenFile = useCallback((filePath: string) => {
    setSelectedWorkspaceFile(filePath);
  }, []);
  const handleTranscriptRetry = useCallback(
    (message: WebAgentUIMessage) => {
      void handleResendUserMessage(message.id);
    },
    [handleResendUserMessage],
  );
  const handleTranscriptDelete = useCallback(
    (message: WebAgentUIMessage) => {
      void handleDeleteUserMessage(message.id);
    },
    [handleDeleteUserMessage],
  );
  const handleTranscriptApprove = useCallback(
    (id: string) => {
      addToolApprovalResponse({ id, approved: true });
    },
    [addToolApprovalResponse],
  );
  const handleTranscriptDeny = useCallback(
    (id: string, reason?: string) => {
      addToolApprovalResponse({ id, approved: false, reason });
    },
    [addToolApprovalResponse],
  );

  const gitPanelElement = gitPanelOpen ? (
    <GitPanel
      session={session}
      hasRepo={hasRepo}
      hasExistingPr={hasExistingPr}
      existingPrUrl={existingPrUrl}
      prDeploymentUrl={prDeploymentUrl}
      buildingDeploymentUrl={buildingDeploymentUrl}
      failedDeploymentUrl={failedDeploymentUrl}
      isDeploymentStale={isDeploymentStale}
      isDeploymentFailed={isDeploymentFailed}
      hasUncommittedGitChanges={hasUncommittedGitChanges}
      supportsRepoCreation={supportsRepoCreation}
      hasDiff={Boolean(diff || session.cachedDiff)}
      canCloseAndArchive={canCloseAndArchive}
      diffFiles={diff?.files ?? null}
      diffSummary={diff?.summary ?? null}
      diffRefreshing={diffRefreshing}
      onCreateRepoClick={() => setRepoDialogOpen(true)}
      refreshDiff={refreshDiff}
      onMerged={handleMerged}
      onCloseAndArchiveClick={() => setCloseDialogOpen(true)}
      onFixChecks={handleFixChecks}
      onFixConflicts={(baseBranchRef: string) =>
        handleFixConflicts(baseBranchRef)
      }
      hasSandbox={sandboxInfo !== null}
      gitStatus={gitStatus}
      gitStatusLoading={gitStatusLoading}
      refreshGitStatus={refreshGitStatus}
      onCommitted={handleCommitted}
      isAgentWorking={hasPendingResponse || isChatInFlight}
      onPrDetected={(pr: {
        prNumber: number;
        prStatus: "open" | "merged" | "closed";
      }) => {
        updateSessionPullRequest(pr);
        void refreshGitStatus().catch(() => {});
      }}
      onGitMessage={upsertSyntheticAssistantGitMessage}
    />
  ) : null;

  return (
    <>
      {/* Git panel portaled to layout-level for full page height */}
      {gitPanelOpen &&
        panelPortalRef.current &&
        createPortal(gitPanelElement, panelPortalRef.current)}

      {/* Header actions portaled from chat-level state */}
      {headerActionsRef.current &&
        showHeaderActions &&
        createPortal(
          <div className="flex items-center gap-1">
            {canUseSandboxActions && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden sm:inline-flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void codeEditor.handleOpen()}
                        disabled={isCodeEditorActionDisabled}
                      >
                        {codeEditor.state.status === "starting" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Code2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-72 text-pretty"
                  >
                    {codeEditorDisabledReason ?? codeEditor.menuLabel}
                  </TooltipContent>
                </Tooltip>
                <div className="hidden h-7 items-center sm:flex">
                  {devServer.state.status === "ready" ? (
                    <div className="flex items-center rounded-md border border-border px-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-sm"
                            onClick={() => void devServer.handlePrimaryAction()}
                          >
                            <Globe className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t("assistant.chatContent.openDevServer")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-sm"
                            onClick={() => void devServer.handleStopAction()}
                          >
                            <Square className="h-2.5 w-2.5 fill-current" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t("assistant.chatContent.stopDevServer")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : devServer.state.status === "starting" ||
                    devServer.state.status === "stopping" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {devServer.state.status === "starting"
                          ? t("assistant.chatContent.startingDevServer")
                          : t("assistant.chatContent.stoppingDevServer")}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void devServer.handlePrimaryAction()}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {t("assistant.chatContent.startDevServer")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </>
            )}
            {previewDeploymentTargetUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="hidden h-7 w-7 sm:inline-flex"
                  >
                    <a
                      href={previewDeploymentTargetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        isDeploymentStale
                          ? t(
                              "assistant.chatContent.openPreviewDeploymentBuilding",
                            )
                          : t("assistant.chatContent.openPreviewDeployment")
                      }
                    >
                      <Globe
                        className={cn(
                          "h-3.5 w-3.5",
                          isDeploymentFailed && "text-red-500",
                          !isDeploymentFailed &&
                            !isDeploymentStale &&
                            "text-green-500",
                          !isDeploymentFailed &&
                            isDeploymentStale &&
                            "animate-pulse text-amber-500",
                        )}
                      />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isDeploymentStale
                    ? t("assistant.chatContent.openPreviewDeploymentBuilding")
                    : t("assistant.chatContent.openPreviewDeployment")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>,
          headerActionsRef.current,
        )}
      <div className="flex h-full flex-col overflow-hidden">
        {/* Share dialog (triggered from header) */}
        <ShareDialog
          sessionId={session.id}
          chatId={chatInfo.id}
          initialShareId={null}
          externalOpen={mobileShareOpen || shareRequested}
          onExternalOpenChange={(open) => {
            setMobileShareOpen(open);
            if (!open) setShareRequested(false);
          }}
        />

        {/* Archive confirmation dialog */}
        <Dialog
          open={mobileArchiveDialogOpen}
          onOpenChange={setMobileArchiveDialogOpen}
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>
                {t("assistant.chatContent.archiveSessionTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("assistant.chatContent.archiveSessionDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">
                  {t("assistant.chatContent.cancel")}
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  onClick={() => {
                    void archiveSession().catch((error: unknown) => {
                      console.error("Failed to archive session:", error);
                    });
                    router.push("/sessions");
                  }}
                >
                  {t("assistant.chatContent.archive")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Main content: chat, diff, or file */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeView === "diff" ? (
            <DiffTabView />
          ) : activeView === "file" ? (
            <FileTabView />
          ) : (
            <>
              {/* Transient error banner (e.g. iOS "Load failed" after sleep) */}
              {error && (
                <div className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  <p className="min-w-0 truncate">{error.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => retryChatStream()}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("assistant.chatContent.retry")}
                  </Button>
                </div>
              )}

              <SharedChatCore
                session={session}
                chat={chatInfo}
                initialMessages={initialMessages}
                modelOptions={modelOptions}
                mode="work"
                density="full"
                runtime={sharedChatRuntime}
                emptyState={
                  <div className="flex h-full min-h-[40vh] items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {t("assistant.chatContent.emptyState")}
                    </p>
                  </div>
                }
                transcriptActions={{
                  onForkMessage: handleTranscriptFork,
                  onOpenFile: handleTranscriptOpenFile,
                }}
                transcriptProps={{
                  messages: renderMessages,
                  status: effectiveStatus,
                  error: error ?? undefined,
                  onRetryMessage: handleTranscriptRetry,
                  onDeleteMessage: handleTranscriptDelete,
                  onApproveTool: handleTranscriptApprove,
                  onDenyTool: handleTranscriptDeny,
                  messageDurationMap,
                  messageStartedAtMap,
                  lastUserMessageSentAt,
                  isChatInFlight,
                  showThinkingIndicator,
                  thinkingMessage:
                    workspaceStatus?.message ??
                    t("assistant.chatContent.thinking"),
                  modelOptions,
                  lastSendStartedAt: lastSendTimestampRef.current
                    ? new Date(lastSendTimestampRef.current).toISOString()
                    : null,
                  actionDisabled: hasMessageActionInFlight,
                  deletingMessageId,
                  resendingMessageId,
                  forkingMessageId: forkingAssistantMessageId,
                }}
                composerRef={composerRef}
                contextUsage={
                  <ContextUsageIndicator
                    inputTokens={tokenUsage.inputTokens}
                    conversationInputTokens={conversationUsage.inputTokens}
                    conversationCachedInputTokens={
                      conversationUsage.cachedInputTokens
                    }
                    conversationOutputTokens={conversationUsage.outputTokens}
                    conversationCost={conversationCost}
                    contextLimit={contextLimit ?? DEFAULT_CONTEXT_LIMIT}
                  />
                }
                composerHeader={
                  <>
                    {sandboxCreateError && (
                      <SandboxCreateErrorBanner
                        error={sandboxCreateError}
                        onDismiss={() => setSandboxCreateError(null)}
                      />
                    )}
                    {restoreError && (
                      <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <span>{restoreError}</span>
                        <button
                          type="button"
                          onClick={() => setRestoreError(null)}
                          className="ml-2 rounded p-0.5 hover:bg-destructive/20"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {deleteMessageError && (
                      <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <span>{deleteMessageError}</span>
                        <button
                          type="button"
                          onClick={() => setDeleteMessageError(null)}
                          className="ml-2 rounded p-0.5 hover:bg-destructive/20"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                }
                workExtensions={{
                  fileSuggestions: suggestions,
                  skillSuggestions: slashSuggestions,
                  todo: <PinnedTodoPanel todos={latestTodos} />,
                  overlay: (
                    <>
                      {showSuggestions && (
                        <FileSuggestionsDropdown
                          suggestions={suggestions}
                          selectedIndex={selectedIndex}
                          onSelect={(suggestion) => {
                            if (mentionInfo) {
                              handleFileSelect(
                                suggestion.value,
                                mentionInfo.mentionStart,
                                cursorPosition,
                              );
                            }
                          }}
                          isLoading={filesLoading}
                        />
                      )}
                      {showSlashCommands && !showSuggestions && (
                        <SlashCommandDropdown
                          suggestions={slashSuggestions}
                          selectedIndex={selectedSlashIndex}
                          onSelect={(suggestion) => {
                            if (slashInfo) {
                              handleSlashCommandSelect(
                                suggestion.name,
                                slashInfo.slashStart,
                                cursorPosition,
                              );
                            }
                          }}
                          isLoading={skillsLoading}
                        />
                      )}
                    </>
                  ),
                }}
                composerProps={{
                  placeholder: showInlineQuestion
                    ? inlineQuestion.placeholder
                    : t("assistant.chatContent.inputPlaceholder"),
                  inputOverlay: (
                    <SandboxInputOverlay
                      isArchived={isArchived}
                      snapshotPending={isArchiveSnapshotPending}
                    />
                  ),
                  questionHeader: showInlineQuestion
                    ? inlineQuestion.questionHeaderUI
                    : undefined,
                  submitControl: showInlineQuestion ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={(event) => {
                        event.preventDefault();
                        inlineQuestion.handleNext();
                      }}
                      disabled={!inlineQuestion.hasCurrentAnswer}
                      className="h-8 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
                    >
                      <Check className="h-3 w-3" />
                      <span className="sm:hidden">
                        {inlineQuestion.compactButtonLabel}
                      </span>
                      <span className="hidden sm:inline">
                        {inlineQuestion.buttonLabel}
                      </span>
                    </Button>
                  ) : undefined,
                  status: effectiveStatus,
                  disabled: isArchived,
                  draft: input,
                  onDraftChange: setInput,
                  onModelChange: handleModelChange,
                  onSubmit: handleComposerSubmit,
                  onStop: () => {
                    stopChatStream();
                    setHasPendingResponse(false);
                    setUserStopped(true);
                    void setChatStreaming(chatInfo.id, false);
                  },
                  modelDisabled:
                    isChatInFlight || isUpdatingModel || modelOptionsLoading,
                  onModelCloseAutoFocus: () => {
                    window.requestAnimationFrame(() => {
                      composerRef.current?.focus();
                      composerRef.current?.setSelectionRange(
                        cursorPosition,
                        cursorPosition,
                      );
                    });
                  },
                  onTextareaFocus: handleTextareaFocus,
                  onTextareaKeyDown: (event) => {
                    if (
                      showInlineQuestion &&
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      inlineQuestion.handleNext();
                      return;
                    }
                    if (handleSuggestionsKeyDown(event)) return;
                    if (handleSlashKeyDown(event)) return;
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !isIosDevice &&
                      !isChatInFlight &&
                      !hasPendingResponse
                    ) {
                      event.preventDefault();
                      if (!isArchived) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  },
                  onCursorPositionChange: setCursorPosition,
                  blurOnSubmitTouch: isIosDevice,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Merge PR Dialog */}
      {session && (
        <MergePrDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          session={session}
          onMerged={handleMerged}
          onViewDiff={() => setShowDiffPanel(true)}
          canViewDiff={supportsDiff && Boolean(diff || session.cachedDiff)}
          isAgentWorking={hasPendingResponse || isChatInFlight}
          onFixChecks={async (failedRuns: CheckRun[]) => {
            setMergeDialogOpen(false);
            await handleFixChecks(failedRuns);
          }}
          onFixConflicts={(baseBranchRef: string) =>
            handleFixConflicts(baseBranchRef, true)
          }
        />
      )}

      {/* Close PR Dialog */}
      {session && (
        <ClosePrDialog
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          session={session}
          onClosed={handleClosed}
        />
      )}

      {/* Create Repo Dialog */}
      {session && (
        <CreateRepoDialog
          open={repoDialogOpen}
          onOpenChange={setRepoDialogOpen}
          session={session}
          hasSandbox={sandboxInfo !== null}
          onRepoCreated={(result: {
            cloneUrl: string;
            owner: string;
            repoName: string;
            branch: string;
          }) => {
            updateSessionRepo({
              cloneUrl: result.cloneUrl,
              repoOwner: result.owner,
              repoName: result.repoName,
              branch: result.branch,
            });
          }}
        />
      )}

      {/* Diff Viewer Modal */}
      <DiffViewer open={showDiffPanel} onOpenChange={setShowDiffPanel} />
      <WorkspaceFileViewer
        sessionId={session.id}
        filePath={selectedWorkspaceFile}
        open={selectedWorkspaceFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWorkspaceFile(null);
          }
        }}
        editorBusy={
          codeEditor.state.status === "starting" ||
          codeEditor.state.status === "stopping"
        }
        editorDisabledReason={codeEditorDisabledReason}
        onOpenInEditor={(filePath) => {
          void codeEditor.handleOpenFile(filePath);
        }}
        onAddToPrompt={(filePath, selectedText, comment) => {
          // Build a single snippet with file ref, selected text, and the user's comment
          const parts = [`File: ${filePath}`, "```", selectedText, "```"];
          if (comment) {
            parts.push("", `> ${comment}`);
          }
          const basename = filePath.split("/").pop() ?? filePath;
          composerRef.current?.addTextAttachment(
            parts.join("\n"),
            `comment-on-${basename}`,
          );
          // Focus the input after a brief delay (keep file viewer open)
          setTimeout(() => {
            composerRef.current?.focus();
          }, 100);
        }}
      />
    </>
  );
}
