"use client";

import type { Position, TradeRecord } from "@/lib/types";
import { DataTable } from "./data-table";
import { ResizablePanel } from "./ui/resizable-panel";
import { useSessionState } from "@/app/context/session-state-context";

interface DataPanelWrapperProps {
  positions: Position[];
  trades: TradeRecord[];
  sessionId: string;
}

export function DataPanelWrapper({ positions: propPositions, trades: propTrades, sessionId }: DataPanelWrapperProps) {
  const { state } = useSessionState();
  const positions = state.positions.length > 0 || state.current_cycle > 0 ? state.positions : propPositions;
  const trades = state.trades.length > 0 || state.current_cycle > 0 ? state.trades : propTrades;

  return (
    <ResizablePanel defaultHeight={280} minHeight={80} maxHeight={600}>
      {({ collapsed, toggleCollapse }) => (
        <DataTable
          positions={positions}
          trades={trades}
          sessionId={sessionId}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      )}
    </ResizablePanel>
  );
}
