"use client";

import { UsageSection } from "../assistant/usage-section";

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">用量统计</h1>
      <UsageSection />
    </div>
  );
}
