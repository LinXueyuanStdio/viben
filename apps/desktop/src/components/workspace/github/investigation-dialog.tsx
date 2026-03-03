/**
 * Investigation Dialog Component
 *
 * Dialog showing AI investigation results for a GitHub issue.
 */

import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Lightbulb,
  Folder,
  FileText,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GitHubIssueInvestigation } from "@/lib/github-client";

interface InvestigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investigating: boolean;
  result: GitHubIssueInvestigation | null;
}

// Complexity colors
const complexityColors = {
  simple: "bg-green-500/10 text-green-600 border-green-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  complex: "bg-red-500/10 text-red-600 border-red-500/30",
};

export function InvestigationDialog({
  open,
  onOpenChange,
  investigating,
  result,
}: InvestigationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {investigating ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : result ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {t("workspaceSettings.github.issues.investigationTitle", "Issue Analysis")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "workspaceSettings.github.issues.investigationDescription",
              "AI analysis of the issue with implementation suggestions"
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {investigating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                {t("workspaceSettings.github.issues.analyzing", "Analyzing issue...")}
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6 pr-4">
              {/* Header badges */}
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={cn("px-2.5 py-1", complexityColors[result.complexity])}
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  {t(`workspaceSettings.github.issues.complexity`, "Complexity")}: {result.complexity}
                </Badge>
                <Badge variant="secondary" className="px-2.5 py-1">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {t("workspaceSettings.github.issues.estimatedFiles", "Estimated Files")}: ~{result.estimated_files}
                </Badge>
              </div>

              {/* Affected Areas */}
              {result.affected_areas.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    {t("workspaceSettings.github.issues.affectedAreas", "Affected Areas")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.affected_areas.map((area, index) => (
                      <Badge key={index} variant="secondary" className="font-mono text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Implementation Hints */}
              {result.implementation_hints.length > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <h4 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    {t("workspaceSettings.github.issues.implementationHints", "Implementation Hints")}
                  </h4>
                  <ul className="space-y-2">
                    {result.implementation_hints.map((hint, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0">{index + 1}.</span>
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Spec saved indicator */}
              {result.spec_path && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t("workspaceSettings.github.issues.specSaved", "Spec file saved to workspace")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    {result.spec_path}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                No analysis results available.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
