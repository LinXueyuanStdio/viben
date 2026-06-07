import { Upload } from "lucide-react"
import { JsonView, darkStyles } from "react-json-view-lite"
import { useTranslation } from "react-i18next"
import type { AgentMessage } from "@viben/chat"
import type { ClaudeCodeSessionManifestItem } from "../claudecode-log-provider"

export type PlayerPageProps = {
  isChatAppFull: boolean
  messages: AgentMessage[]
  sessionInfo: string
  sessionLoadError: string | null
  sessions: ClaudeCodeSessionManifestItem[]
  activeSession: ClaudeCodeSessionManifestItem | null
  isLoadingSession: boolean
  progress: number
  stepIndex: number
  totalSteps: number
  speedLabel: string
  isPlaying: boolean
  isAwaiting: boolean
  renderChatAppModeControls: () => React.ReactNode
  renderPlayerControls: () => React.ReactNode
  onFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void
  onFolderLoad: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSessionLoad: (session: ClaudeCodeSessionManifestItem) => void
  onSeek: (value: number) => void
}

export function PlayerPage({
  isChatAppFull,
  messages,
  sessionInfo,
  sessionLoadError,
  sessions,
  activeSession,
  isLoadingSession,
  progress,
  stepIndex,
  totalSteps,
  speedLabel,
  isPlaying,
  isAwaiting,
  renderChatAppModeControls,
  renderPlayerControls,
  onFileLoad,
  onFolderLoad,
  onSessionLoad,
  onSeek,
}: PlayerPageProps) {
  const { t } = useTranslation()

  return (
    <>
      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-4"}>
        {!isChatAppFull && (
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">{t("example.title", "Chat component lab")}</h1>
            <p className="text-sm text-muted-foreground">{t("example.subtitle", "Replay sessions, inspect component states, and switch overlay modes from one control surface.")}</p>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Upload className="size-3.5" />
            .jsonl
            <input type="file" accept=".jsonl" hidden onChange={onFileLoad} />
          </label>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Upload className="size-3.5" />
            {t("example.load.session_folder", "Session Folder")}
            {/* @ts-expect-error webkitdirectory is non-standard but widely supported */}
            <input type="file" hidden webkitdirectory="true" onChange={onFolderLoad} />
          </label>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">{sessionInfo}</p>
        {sessionLoadError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
            {sessionLoadError}
          </p>
        )}

        <div className="space-y-1.5">
          <SectionLabel>{t("example.sections.sessions", "Claude Code Sessions")}</SectionLabel>
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSessionLoad(session)}
              disabled={isLoadingSession}
              className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                activeSession?.id === session.id
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              } disabled:cursor-wait disabled:opacity-60`}
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{session.label}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {t("example.session.meta", "{{count}} subagents · real JSONL", { count: session.subagents.length })}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <SectionLabel>{t("example.sections.chatAppMode", "Chat App Mode")}</SectionLabel>
          {renderChatAppModeControls()}
        </div>

        {isAwaiting && (
          <div className="flex items-center justify-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1">
            <div className="size-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t("example.status.waiting", "Waiting for user action")}
            </span>
          </div>
        )}

        {renderPlayerControls()}

        <div className="flex items-center gap-2">
          <div
            className="h-1 flex-1 cursor-pointer rounded-full bg-muted"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              onSeek((event.clientX - rect.left) / rect.width)
            }}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {stepIndex}/{totalSteps}
          </span>
        </div>
        <span className="sr-only">
          {isPlaying ? "playing" : "paused"} {speedLabel}
        </span>
      </DashboardCard>

      {messages.length > 0 && (
        <DashboardCard className={isChatAppFull ? "space-y-2" : "space-y-2 xl:col-start-2 xl:row-span-2"}>
          <SectionLabel>{t("example.sections.nowPlaying", "Now Playing")}</SectionLabel>
          <div className="max-h-[240px] overflow-x-auto overflow-y-auto rounded-lg border bg-muted/30 p-2 text-[10px] [&_*]:!text-[10px] [&_*]:!leading-relaxed">
            <JsonView data={messages[messages.length - 1]} style={darkStyles} />
          </div>
        </DashboardCard>
      )}
    </>
  )
}

function DashboardCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border bg-card p-4 shadow-sm ${className ?? ""}`}>
      {children}
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h3>
  )
}
