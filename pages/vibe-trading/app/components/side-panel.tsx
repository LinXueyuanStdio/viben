"use client";

import { useState } from "react";
import { DecisionLog } from "./decision-log";
import { AgentPanel } from "./agent-panel";
import { useVibenConnection } from "@/app/context/viben-connection-context";
import type { DecisionEntry } from "@/lib/types";

interface SidePanelProps {
  initialDecisions: DecisionEntry[];
}

export function SidePanel({ initialDecisions }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<"decisions" | "agent">("decisions");
  const conn = useVibenConnection();

  const statusDotColor = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    disconnected: "bg-slate-400",
    error: "bg-red-500",
  }[conn?.connectionState ?? "disconnected"];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-200 px-2 shrink-0">
        <button
          onClick={() => setActiveTab("decisions")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "decisions"
              ? "border-slate-800 text-slate-800"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          决策
        </button>
        <button
          onClick={() => setActiveTab("agent")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "agent"
              ? "border-slate-800 text-slate-800"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Agent
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "decisions" ? (
          <DecisionLog initialDecisions={initialDecisions} />
        ) : (
          <AgentPanel />
        )}
      </div>
    </div>
  );
}
