/**
 * File Too Large Component
 *
 * Displays a message when a file is too large to preview in the app.
 * Provides option to open the file in an external system application.
 */

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Artifact } from "./types";
import { formatFileSize } from "./utils";

interface FileTooLargeProps {
  artifact: Artifact;
  fileSize: number;
  icon: React.ComponentType<{ className?: string }>;
  onOpenExternal: () => void;
  appName?: string;
}

export function FileTooLarge({
  artifact,
  fileSize,
  icon: Icon,
  onOpenExternal,
  appName,
}: FileTooLargeProps) {
  const { t } = useTranslation();
  const displayAppName = appName || t("artifacts.defaultApp");

  return (
    <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
          <Icon className="text-muted-foreground size-10" />
        </div>
        <h3 className="text-foreground mb-2 text-lg font-medium">
          {artifact.name}
        </h3>
        <p className="text-muted-foreground mb-1 text-sm">
          {t("artifacts.fileSize", { size: formatFileSize(fileSize) })}
        </p>
        <p className="text-muted-foreground mb-6 text-sm">
          {t("artifacts.fileTooLargeDesc")}
        </p>
        <button
          onClick={onOpenExternal}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <ExternalLink className="size-4" />
          {t("artifacts.openIn", { name: displayAppName })}
        </button>
      </div>
    </div>
  );
}
