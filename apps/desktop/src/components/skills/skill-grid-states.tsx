import type { ReactNode } from "react";
import { AlertCircle, Package, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillGridErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

interface SkillGridEmptyProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

interface SkillGridShellProps {
  children: ReactNode;
  className?: string;
}

export function SkillGridError({
  message,
  onRetry,
  className,
}: SkillGridErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center",
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-destructive" />
      <h3 className="mt-3 text-sm font-medium text-foreground">
        {t("skillsMarket.loadFailed", "Failed to load skills")}
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function SkillGridEmpty({
  title,
  description,
  onRetry,
  className,
}: SkillGridEmptyProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center",
        className
      )}
    >
      <Package className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-medium text-foreground">
        {title ?? t("skillsMarket.noSkillsFound")}
      </h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function SkillGridShell({ children, className }: SkillGridShellProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}
