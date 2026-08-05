import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "订阅管理",
};

export default function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">订阅管理</h1>
      <p className="text-muted-foreground">
        订阅计划和用量配额管理即将上线。
      </p>
    </div>
  );
}
