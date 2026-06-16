"use client";

import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { LeaderboardTable } from "./leaderboard-table";

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json() as { entries: LeaderboardEntry[] };
        setEntries(data.entries);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        暂无策略数据，创建交易会话后将自动生成排行
      </div>
    );
  }

  return <LeaderboardTable entries={entries} />;
}
