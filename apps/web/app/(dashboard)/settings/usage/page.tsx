import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "用量统计",
};

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">用量统计</h1>
      <p className="text-muted-foreground">
        Token 消耗统计和费用估算即将上线。
      </p>
    </div>
  );
}
