import type React from "react";
import { ExternalLink } from "lucide-react";

export interface LinkButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  onClick: (url: string) => void;
}

export function LinkButton({ icon: Icon, label, href, onClick }: LinkButtonProps) {
  return (
    <button
      onClick={() => onClick(href)}
      className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-muted hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 w-full"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
