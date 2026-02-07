"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, cn } from "@viben/ui";

interface StatCardProps {
  label: string;
  value: number | string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2">
        <span className="text-2xl font-semibold">{value}</span>
        {subValue && (
          <span className="ml-1 text-sm text-muted-foreground">{subValue}</span>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          {trend === "up" && (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          {trend === "neutral" && (
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
          <span
            className={cn(
              trend === "up" && "text-green-500",
              trend === "down" && "text-red-500",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trendValue}
          </span>
        </div>
      )}
    </Card>
  );
}

export type { StatCardProps };
