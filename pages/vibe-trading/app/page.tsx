import { restoreSessionState } from "@/lib/state-machine";
import { getActiveSessionId, listSessionSummaries, readAllEvents } from "@/lib/session-store";
import { readAccounts } from "@/lib/account-store";
import { startAutoTrading, isAutoTradingActive } from "@/lib/scheduler";
import { SessionStateProvider } from "./context/session-state-context";
import { VibenConnectionProvider } from "./context/viben-connection-context";
import { VibenActionProvider } from "./components/viben-action-provider";
import { PlayerBar } from "./components/player-bar";
import { TopNav } from "./components/top-nav";
import { StatCards } from "./components/stat-cards";
import { ChartArea } from "./components/chart-area";
import { DataTable } from "./components/data-table";
import { DataPanelWrapper } from "./components/data-panel-wrapper";
import { SidePanel } from "./components/side-panel";
import { CreateSessionForm } from "./components/create-session-form";
import { OnboardingDashboard } from "./components/onboarding-dashboard";
import { ResizableSidebar } from "./components/ui/resizable-sidebar";

interface Props {
  searchParams: Promise<{ session?: string; create?: string; workspace_path?: string }>;
}

export default async function TradingPage({ searchParams }: Props) {
  const { session: sessionParam, create, workspace_path } = await searchParams;
  const sessions = await listSessionSummaries();

  if (create === "true") {
    const accounts = await readAccounts();
    return (
      <div className="min-h-screen bg-white">
        <CreateSessionForm accounts={accounts} />
      </div>
    );
  }

  // Auto-select: param override > active session (running > paused > ended) > null
  const sessionId = sessionParam ?? (await getActiveSessionId());

  if (!sessionId) {
    return <OnboardingDashboard />;
  }

  const state = await restoreSessionState(sessionId);
  const allEvents = await readAllEvents(sessionId);

  if (state.status === "running" && !isAutoTradingActive(sessionId)) {
    startAutoTrading(sessionId, state.agent_config.interval_minutes);
  }

  return (
    <SessionStateProvider
      initialState={state}
      allEvents={allEvents}
      sessionId={sessionId}
      intervalMinutes={state.agent_config.interval_minutes}
    >
      <VibenConnectionProvider>
        <VibenActionProvider sessionId={sessionId} />
        <div className="flex h-screen overflow-hidden">
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <TopNav
              sessionName={state.session_name}
              status={state.status}
              tags={state.tags}
              sessionId={sessionId}
              sessions={sessions}
              agentConfig={state.agent_config}
            />
            <PlayerBar />
            <StatCards metrics={state.metrics} initialBalance={state.initial_balance} />
            <div className="flex-1 min-h-0 flex flex-col">
              <ChartArea
                sessionId={sessionId}
                symbols={state.agent_config.symbols ?? []}
                exchange={state.exchange}
                navHistory={state.nav_history ?? []}
                initialNav={Object.values(state.initial_balance ?? {}).reduce((s, v) => s + v, 0)}
                workspacePath={workspace_path}
              />
              <DataPanelWrapper
                positions={state.positions}
                trades={state.trades}
                sessionId={sessionId}
              />
            </div>
          </main>
          <ResizableSidebar defaultWidth={380} minWidth={260} maxWidth={600}>
            <SidePanel initialDecisions={state.decisions} />
          </ResizableSidebar>
        </div>
      </VibenConnectionProvider>
    </SessionStateProvider>
  );
}
