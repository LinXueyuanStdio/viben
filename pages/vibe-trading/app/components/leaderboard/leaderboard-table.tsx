"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { MiniSparkline } from "../ui/mini-sparkline";
import { CopyStrategyButton } from "./copy-strategy-button";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

type SortField = "cumulative_return_pct" | "max_drawdown_pct" | "sharpe_ratio" | "win_rate" | "profit_loss_ratio" | "daily_return_pct" | "total_trades" | "running_days";

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const [sortField, setSortField] = useState<SortField>("cumulative_return_pct");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    const diff = (a[sortField] as number) - (b[sortField] as number);
    return sortAsc ? diff : -diff;
  });

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function rankIcon(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  }

  const headerClass = "px-2 py-1.5 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap";
  const cellClass = "px-2 py-1.5 text-xs whitespace-nowrap";

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className={headerClass}>#</th>
            <th className={`${headerClass} text-left`}>策略名称</th>
            <th className={headerClass} onClick={() => handleSort("cumulative_return_pct")}>累计收益</th>
            <th className={headerClass} onClick={() => handleSort("max_drawdown_pct")}>最大回撤</th>
            <th className={headerClass} onClick={() => handleSort("sharpe_ratio")}>夏普</th>
            <th className={headerClass} onClick={() => handleSort("win_rate")}>胜率</th>
            <th className={headerClass} onClick={() => handleSort("profit_loss_ratio")}>盈亏比</th>
            <th className={headerClass} onClick={() => handleSort("daily_return_pct")}>日均收益</th>
            <th className={headerClass}>净值曲线</th>
            <th className={headerClass}>标的数</th>
            <th className={headerClass}>最近操作</th>
            <th className={headerClass} onClick={() => handleSort("running_days")}>运行天数</th>
            <th className={headerClass} onClick={() => handleSort("total_trades")}>操作次数</th>
            <th className={headerClass}>操作</th>
          </tr>
        </thead>
        {sorted.map((entry, i) => (
          <tbody key={entry.session_id}>
            <tr
              onClick={() => setExpandedId(expandedId === entry.session_id ? null : entry.session_id)}
              className="border-b border-border/50 hover:bg-muted cursor-pointer"
            >
              <td className={`${cellClass} text-center`}>{rankIcon(i + 1)}</td>
              <td className={`${cellClass} font-medium`}>{entry.session_name}</td>
              <td className={`${cellClass} text-right ${entry.cumulative_return_pct >= 0 ? "text-gain" : "text-loss"}`}>
                {entry.cumulative_return_pct >= 0 ? "+" : ""}{entry.cumulative_return_pct}%
              </td>
              <td className={`${cellClass} text-right text-loss`}>{entry.max_drawdown_pct}%</td>
              <td className={`${cellClass} text-right`}>{entry.sharpe_ratio}</td>
              <td className={`${cellClass} text-right`}>{entry.win_rate}%</td>
              <td className={`${cellClass} text-right`}>{entry.profit_loss_ratio}</td>
              <td className={`${cellClass} text-right ${entry.daily_return_pct >= 0 ? "text-gain" : "text-loss"}`}>
                {entry.daily_return_pct >= 0 ? "+" : ""}{entry.daily_return_pct}%
              </td>
              <td className={cellClass}>
                <MiniSparkline
                  data={entry.nav_history}
                  width={60}
                  height={18}
                  color={entry.cumulative_return_pct >= 0 ? "#16a34a" : "#dc2626"}
                />
              </td>
              <td className={`${cellClass} text-center`}>{entry.symbols_count}</td>
              <td className={`${cellClass} text-right text-muted-foreground`}>
                {formatRelativeTime(entry.last_trade_time)}
              </td>
              <td className={`${cellClass} text-right`}>{entry.running_days}d</td>
              <td className={`${cellClass} text-right`}>{entry.total_trades}</td>
              <td className={cellClass}>
                <CopyStrategyButton agentConfig={entry.agent_config} sessionName={entry.session_name} />
              </td>
            </tr>
            {expandedId === entry.session_id && (
              <tr className="bg-muted">
                <td colSpan={14} className="px-4 py-3 text-xs text-muted-foreground">
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="font-medium">策略：</span>{entry.agent_config.strategy_name}</div>
                    <div><span className="font-medium">模型：</span>{entry.agent_config.model}</div>
                    <div><span className="font-medium">风险：</span>{entry.agent_config.risk_level}</div>
                    <div><span className="font-medium">标的：</span>{entry.agent_config.symbols?.join(", ")}</div>
                    <div><span className="font-medium">周期：</span>{entry.agent_config.interval_minutes}min</div>
                    <div><span className="font-medium">最大仓位：</span>{entry.agent_config.max_position_pct}%</div>
                  </div>
                  <div className="mt-2"><span className="font-medium">描述：</span>{entry.agent_config.strategy_description}</div>
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}
