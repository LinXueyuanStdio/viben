export interface PropertyRowProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

export function PropertyRow({ label, icon: Icon, children }: PropertyRowProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5 w-20 text-xs text-muted-foreground shrink-0">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
