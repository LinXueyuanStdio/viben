"use client";

import { useState } from "react";
import type { SessionInitEvent } from "@/lib/types";

interface CopyStrategyButtonProps {
  agentConfig: SessionInitEvent["agent_config"];
  sessionName: string;
}

export function CopyStrategyButton({ agentConfig, sessionName }: CopyStrategyButtonProps) {
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: `${sessionName} (副本)`,
          ...agentConfig,
        }),
      });
      if (!res.ok) throw new Error("Failed to copy");
      alert("策略已复制，新会话已创建");
    } catch (err) {
      alert(`复制失败: ${err}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      disabled={copying}
      className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 disabled:opacity-50"
    >
      {copying ? "复制中..." : "复制策略"}
    </button>
  );
}
