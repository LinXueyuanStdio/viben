"use client";

import {
  ChevronDownIcon,
  ChevronRight,
  ChevronUpIcon,
  Cloud,
  GitCommitHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VibenLogo } from "@/components/shared/viben-logo";
import { useAudioRecording } from "@/hooks/assistant/use-audio-recording";
import { useGitHubConnectionStatus } from "@/hooks/assistant/use-github-connection-status";
import { useImageAttachments } from "@/hooks/assistant/use-image-attachments";
import { useModelOptions } from "@/hooks/assistant/use-model-options";
import { useSession } from "@/hooks/assistant/use-session";
import { useTextAttachments } from "@/hooks/assistant/use-text-attachments";
import { useUserPreferences } from "@/hooks/assistant/use-user-preferences";
import { useVercelRepoProjects } from "@/hooks/assistant/use-vercel-repo-projects";
import type { VercelProjectSelection } from "@/lib/vercel/types";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import type { StarterMessageDraft } from "./starter-message-handoff";
import { AssistantPromptComposer } from "./assistant-prompt-composer";
import { BranchSelectorCompact } from "./branch-selector-compact";
import { RepoSelectorCompact } from "./repo-selector-compact";
import {
  DEFAULT_SANDBOX_TYPE,
  type SandboxType,
} from "./sandbox-selector-compact";
import { SessionStarterVercelSyncSection } from "./session-starter-vercel-sync-section";

type SessionMode = "chat" | "repo";

export interface SessionStarterCreateInput {
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  cloneUrl?: string;
  isNewBranch: boolean;
  sandboxType: SandboxType;
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  vercelProject?: VercelProjectSelection | null;
}

export interface SessionStarterSubmitInput {
  sessionInput: SessionStarterCreateInput;
  draft: StarterMessageDraft;
}

interface SessionStarterProps {
  onSubmit: (input: SessionStarterSubmitInput) => Promise<void>;
  isLoading?: boolean;
  lastRepo?: { owner: string; repo: string } | null;
}

export function SessionStarter({
  onSubmit,
  isLoading = false,
}: SessionStarterProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SessionMode>("chat");
  const [repoPopoverOpen, setRepoPopoverOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isNewBranch, setIsNewBranch] = useState(false);
  const [vercelProjectChoice, setVercelProjectChoice] = useState<
    string | null | undefined
  >(undefined);
  const [autoCommitPush, setAutoCommitPush] = useState<boolean | null>(null);
  const [autoCreatePr, setAutoCreatePr] = useState<boolean | null>(null);
  const [gitSettingsExpanded, setGitSettingsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(APP_DEFAULT_MODEL_ID);

  const { session, loading: sessionLoading, hasGitHub } = useSession();
  const isTrialUser = session?.isManagedTemplateTrialUser ?? false;
  const { reconnectRequired, isLoading: githubConnectionLoading } =
    useGitHubConnectionStatus({ enabled: hasGitHub });
  const { preferences, loading: preferencesLoading } = useUserPreferences();
  const { modelOptions, loading: modelOptionsLoading } = useModelOptions();
  const {
    images,
    addImage,
    addImages,
    removeImage,
    clearImages,
    fileInputRef,
    openFilePicker,
  } = useImageAttachments();
  const {
    textAttachments,
    addTextAttachment,
    removeTextAttachment,
    clearTextAttachments,
  } = useTextAttachments();
  const {
    state: recordingState,
    error: recordingError,
    clearError: clearRecordingError,
    toggleRecording,
  } = useAudioRecording();

  useEffect(() => {
    if (preferences?.defaultModelId) {
      setSelectedModelId(preferences.defaultModelId);
    }
  }, [preferences?.defaultModelId]);

  const defaultAutoCommitPush = preferences?.autoCommitPush ?? false;
  const defaultAutoCreatePr = preferences?.autoCreatePr ?? false;
  const effectiveAutoCommitPush = autoCommitPush ?? defaultAutoCommitPush;
  const effectiveAutoCreatePr = autoCreatePr ?? defaultAutoCreatePr;
  const sandboxType = preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE;
  const isRepoModeDisabled = sessionLoading || isTrialUser;

  const shouldLoadVercelProjects =
    mode === "repo" &&
    !isTrialUser &&
    !githubConnectionLoading &&
    !reconnectRequired &&
    Boolean(selectedOwner) &&
    Boolean(selectedRepo) &&
    session?.authProvider === "vercel";
  const {
    data: repoProjects,
    loading: repoProjectsLoading,
    error: repoProjectsError,
  } = useVercelRepoProjects({
    enabled: shouldLoadVercelProjects,
    repoOwner: selectedOwner,
    repoName: selectedRepo,
  });

  useEffect(() => {
    if (!shouldLoadVercelProjects) {
      setVercelProjectChoice(undefined);
      return;
    }
    if (!repoProjects || repoProjectsLoading) return;
    if (repoProjects.selectedProjectId) {
      setVercelProjectChoice(repoProjects.selectedProjectId);
    } else if (repoProjects.projects.length === 0) {
      setVercelProjectChoice(null);
    } else {
      setVercelProjectChoice(undefined);
    }
  }, [repoProjects, repoProjectsLoading, shouldLoadVercelProjects]);

  const resetRepoSelection = () => {
    setMode("chat");
    setSelectedOwner("");
    setSelectedRepo("");
    setSelectedBranch(null);
    setIsNewBranch(false);
    setVercelProjectChoice(undefined);
    setGitSettingsExpanded(false);
  };

  const handleRepoPopoverChange = (open: boolean) => {
    if (open && isRepoModeDisabled) return;
    setRepoPopoverOpen(open);
    if (open) {
      setMode("repo");
      return;
    }
    if (!selectedOwner || !selectedRepo) resetRepoSelection();
  };

  const handleRepoSelect = (owner: string, repo: string) => {
    setSelectedOwner(owner);
    setSelectedRepo(repo);
    setSelectedBranch(null);
    setIsNewBranch(false);
    setVercelProjectChoice(undefined);
  };

  const handleBranchChange = (branch: string | null, newBranch: boolean) => {
    setSelectedBranch(branch);
    setIsNewBranch(newBranch);
  };

  const handleMicClick = async () => {
    clearRecordingError();
    const transcribedText = await toggleRecording();
    if (!transcribedText) return;
    setInput((current) =>
      current ? `${current} ${transcribedText}` : transcribedText,
    );
    inputRef.current?.focus();
  };

  const isVercelLookupPending =
    mode === "repo" &&
    Boolean(selectedOwner) &&
    Boolean(selectedRepo) &&
    (sessionLoading || (shouldLoadVercelProjects && repoProjectsLoading));
  const requiresVercelChoice =
    shouldLoadVercelProjects &&
    !repoProjectsLoading &&
    !repoProjectsError &&
    Boolean(repoProjects) &&
    Boolean(repoProjects?.projects.length) &&
    repoProjects?.selectedProjectId === null &&
    vercelProjectChoice === undefined;
  const showVercelProjectSection =
    mode === "repo" &&
    !isTrialUser &&
    !githubConnectionLoading &&
    !reconnectRequired &&
    Boolean(selectedOwner) &&
    Boolean(selectedRepo) &&
    (sessionLoading || session?.authProvider === "vercel");
  const hasContent =
    Boolean(input.trim()) || images.length > 0 || textAttachments.length > 0;
  const controlsDisabled = isLoading || submitting || preferencesLoading;
  const isSubmitDisabled =
    controlsDisabled ||
    recordingState === "processing" ||
    !hasContent ||
    (mode === "repo" &&
      (isRepoModeDisabled ||
        githubConnectionLoading ||
        reconnectRequired ||
        !selectedOwner ||
        !selectedRepo ||
        isVercelLookupPending ||
        requiresVercelChoice));

  const resolveVercelProject = () => {
    if (!shouldLoadVercelProjects) return undefined;
    if (repoProjectsError || !repoProjects) return undefined;
    if (vercelProjectChoice === null) return null;
    if (typeof vercelProjectChoice !== "string") return undefined;
    return (
      repoProjects.projects.find(
        (project) => project.projectId === vercelProjectChoice,
      ) ?? null
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) return;

    setSubmitting(true);
    try {
      await onSubmit({
        sessionInput: {
          repoOwner: mode === "repo" ? selectedOwner : undefined,
          repoName: mode === "repo" ? selectedRepo : undefined,
          branch: mode === "repo" ? (selectedBranch ?? undefined) : undefined,
          cloneUrl:
            mode === "repo"
              ? `https://github.com/${selectedOwner}/${selectedRepo}`
              : undefined,
          isNewBranch: mode === "repo" ? isNewBranch : false,
          sandboxType,
          autoCommitPush: effectiveAutoCommitPush,
          autoCreatePr: effectiveAutoCommitPush ? effectiveAutoCreatePr : false,
          vercelProject: resolveVercelProject(),
        },
        draft: {
          text: input,
          images,
          textAttachments,
          modelId: selectedModelId,
        },
      });
      setInput("");
      clearImages();
      clearTextAttachments();
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const repoSettings = (
    <div className="flex max-h-[min(70vh,38rem)] flex-col gap-3 overflow-y-auto p-1">
      <RepoSelectorCompact
        selectedOwner={selectedOwner}
        selectedRepo={selectedRepo}
        onSelect={handleRepoSelect}
      />
      {selectedOwner &&
        selectedRepo &&
        !githubConnectionLoading &&
        !reconnectRequired && (
          <BranchSelectorCompact
            owner={selectedOwner}
            repo={selectedRepo}
            value={selectedBranch}
            isNewBranch={isNewBranch}
            onChange={handleBranchChange}
          />
        )}
      {showVercelProjectSection && (
        <SessionStarterVercelSyncSection
          controlsDisabled={controlsDisabled}
          isVercelLookupPending={isVercelLookupPending}
          repoProjects={repoProjects}
          repoProjectsError={repoProjectsError}
          requiresVercelChoice={requiresVercelChoice}
          vercelProjectChoice={vercelProjectChoice}
          onVercelProjectChoiceChange={setVercelProjectChoice}
        />
      )}
      {selectedOwner && selectedRepo && !gitSettingsExpanded && (
        <button
          type="button"
          onClick={() => setGitSettingsExpanded(true)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-2.5 text-left transition-colors duration-200 hover:bg-muted/40"
        >
          <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {effectiveAutoCommitPush
              ? t("assistant.sessionStarter.autoCommit")
              : t("assistant.sessionStarter.autoCommitPushDisabled")}
          </span>
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
      {selectedOwner && selectedRepo && gitSettingsExpanded && (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20">
          <button
            type="button"
            onClick={() => setGitSettingsExpanded(false)}
            className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors duration-200 hover:bg-muted/30"
          >
            <span className="text-sm font-medium">
              {t("assistant.sessionStarter.autoCommitAndPush")}
            </span>
            <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
            <span className="text-sm font-medium">
              {t("assistant.sessionStarter.commitAndPush")}
            </span>
            <Switch
              checked={effectiveAutoCommitPush}
              onCheckedChange={setAutoCommitPush}
              disabled={controlsDisabled}
            />
          </div>
          {effectiveAutoCommitPush && (
            <div className="flex items-center justify-between border-t border-border/30 px-3 py-2 pl-6">
              <span className="text-sm text-muted-foreground">
                {t("assistant.sessionStarter.createPullRequest")}
              </span>
              <Switch
                checked={effectiveAutoCreatePr}
                onCheckedChange={setAutoCreatePr}
                disabled={controlsDisabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-4xl space-y-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <VibenLogo size={52} className="shadow-sm" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("assistant.sessionStarter.welcomeTitle")}
        </h1>
      </header>

      <AssistantPromptComposer
        inputRef={inputRef}
        fileInputRef={fileInputRef}
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        placeholder={t("assistant.chatContent.inputPlaceholder")}
        images={images}
        textAttachments={textAttachments}
        onRemoveImage={removeImage}
        onRemoveTextAttachment={removeTextAttachment}
        onAddImage={addImage}
        onAddImages={addImages}
        onAddLargeText={(text) => {
          addTextAttachment(text);
        }}
        onOpenFilePicker={openFilePicker}
        modelId={selectedModelId}
        modelOptions={modelOptions}
        onModelChange={setSelectedModelId}
        modelDisabled={modelOptionsLoading}
        recordingState={recordingState}
        onMicClick={() => {
          void handleMicClick();
        }}
        disabled={controlsDisabled}
        submitting={submitting || isLoading}
        canSubmit={!isSubmitDisabled}
        labels={{
          attachFiles: t("assistant.sessionStarter.attachFiles"),
          voiceInput: t("assistant.sessionStarter.voiceInput"),
          sendMessage: t("assistant.sessionStarter.sendMessage"),
        }}
        className="border border-border/70 bg-card shadow-lg shadow-black/5 dark:border-white/10 dark:shadow-none"
        footer={
          <div className="flex items-center border-t border-border/60 bg-muted/60 px-3 py-2">
            <Link
              href="/settings/sandbox"
              aria-label={t("assistant.sessionStarter.openSandboxSettings")}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Cloud className="h-4 w-4" />
            </Link>
            <div className="mx-2 h-5 w-px bg-border/70" />
            <Popover
              open={repoPopoverOpen}
              onOpenChange={handleRepoPopoverChange}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={controlsDisabled || isRepoModeDisabled}
                  className="flex min-h-9 flex-1 cursor-pointer items-center justify-between rounded-lg px-3 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    {mode === "repo"
                      ? t("assistant.sessionStarter.newSession")
                      : t("assistant.sessionStarter.newChat")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="bottom"
                className="w-[min(42rem,calc(100vw-2rem))] p-3"
              >
                {repoSettings}
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {recordingError && (
        <p className="text-center text-sm text-destructive">{recordingError}</p>
      )}
    </div>
  );
}
