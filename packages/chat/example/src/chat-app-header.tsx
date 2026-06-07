import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, ChevronUp, Plus, Search } from "lucide-react";

export interface ChatAppSessionItem {
  id: string;
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
}

export interface ChatAppAgentItem {
  id: string;
  name: string;
  type: string;
  avatar?: React.ReactNode;
}

export interface ExpandedHeaderSessionMenuProps {
  title: string;
  sessions: ChatAppSessionItem[];
  assistantAvatar: React.ReactNode;
  onSelectSession?: (session: ChatAppSessionItem) => void;
}

export interface ExpandedHeaderNewSessionMenuProps {
  agents: ChatAppAgentItem[];
  onCreateSession?: () => void;
  onNewChat?: () => void;
  onNewChatWindow?: () => void;
  onSelectAgent?: (agent: ChatAppAgentItem) => void;
}

export function ExpandedHeaderSessionMenu({
  title,
  sessions,
  assistantAvatar,
  onSelectSession,
}: ExpandedHeaderSessionMenuProps) {
  const { t } = useTranslation();
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [selectedSessionTitle, setSelectedSessionTitle] = React.useState(title);

  React.useEffect(() => {
    setSelectedSessionTitle(title);
  }, [title]);

  return (
    <div className="relative" data-testid="session-title-menu">
      <button
        type="button"
        aria-label={t("chat_app.header.session_menu", "Session menu")}
        onClick={() => setSessionOpen((open) => !open)}
        className="flex h-8 max-w-[164px] items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        <span className="truncate">{selectedSessionTitle}</span>
        {sessionOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {sessionOpen && (
        <div className="absolute left-0 top-10 z-20 w-72 rounded-lg border border-border bg-popover p-2 shadow-xl">
          <label className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="search"
              aria-label={t("chat_app.header.search_sessions", "Search sessions")}
              placeholder={t("chat_app.header.search_sessions", "Search sessions")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="mt-2 space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setSelectedSessionTitle(session.title);
                  onSelectSession?.(session);
                  setSessionOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {session.avatar ?? assistantAvatar}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{session.title}</span>
                  {session.subtitle && <span className="block truncate text-[11px] text-muted-foreground">{session.subtitle}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpandedHeaderNewSessionMenu({
  agents,
  onCreateSession,
  onNewChat,
  onNewChatWindow,
  onSelectAgent,
}: ExpandedHeaderNewSessionMenuProps) {
  const { t } = useTranslation();
  const [newOpen, setNewOpen] = React.useState(false);

  return (
    <div
      className="relative flex h-8 shrink-0 overflow-hidden rounded-md border border-border bg-background"
      data-testid="new-session-split-button"
    >
      <button
        type="button"
        aria-label={t("chat_app.header.create_session", "Create new session")}
        onClick={onCreateSession}
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
      <div className="h-full border-l border-border" />
      <button
        type="button"
        aria-label={t("chat_app.header.open_new_session_menu", "Open new session menu")}
        onClick={() => setNewOpen((open) => !open)}
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronDown className="size-4" data-testid="new-session-menu-chevron" />
      </button>
      {newOpen && (
        <div className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
          <MenuButton onClick={onNewChat}>{t("chat_app.header.new_chat", "New chat")}</MenuButton>
          <MenuButton onClick={onNewChatWindow}>{t("chat_app.header.new_chat_window", "New chat window")}</MenuButton>
          <MenuDivider />
          {agents.map((agent) => (
            <MenuButton key={agent.id} onClick={() => onSelectAgent?.(agent)}>
              <span className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {agent.avatar ?? <Bot className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{agent.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{agent.type}</span>
                </span>
              </span>
            </MenuButton>
          ))}
        </div>
      )}
    </div>
  );
}

export function DefaultExpandedHeaderMoreMenu({
  onSettingsClick,
  onPrevious,
  onNext,
  onMoveToWindow,
  onShowDebugView,
  onShowDebugLog,
}: {
  onSettingsClick?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onMoveToWindow?: () => void;
  onShowDebugView?: () => void;
  onShowDebugLog?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <MenuButton onClick={onSettingsClick}>{t("chat_app.header.settings", "Settings")}</MenuButton>
      <MenuDivider />
      <MenuButton onClick={onPrevious}>{t("chat_app.header.previous_step", "Previous step")}</MenuButton>
      <MenuButton onClick={onNext}>{t("chat_app.header.next_step", "Next step")}</MenuButton>
      <MenuDivider />
      <MenuButton onClick={onMoveToWindow}>{t("chat_app.header.move_to_window", "Move chat to new window")}</MenuButton>
      <MenuDivider />
      <MenuButton onClick={onShowDebugView}>{t("chat_app.header.show_debug_view", "Show debug view")}</MenuButton>
      <MenuButton onClick={onShowDebugLog}>{t("chat_app.header.show_debug_log", "Show debug log")}</MenuButton>
    </>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-border/70" />;
}
