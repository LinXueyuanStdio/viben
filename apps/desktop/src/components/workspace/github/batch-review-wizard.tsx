/**
 * Batch Review Wizard Component
 *
 * Multi-step wizard for batch processing multiple GitHub issues.
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  CircleDot,
  AlertCircle,
  Sparkles,
  Play,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GitHubIssue, GitHubIssueInvestigation } from "@/lib/github-client";

type WizardStep = "select" | "analyze" | "review" | "execute";

interface BatchReviewWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: GitHubIssue[];
  selectedNumbers: Set<number>;
  onAnalyze: (issueNumber: number) => Promise<GitHubIssueInvestigation | null>;
  onExecute: (issueNumbers: number[]) => Promise<void>;
}

interface AnalysisResult {
  issueNumber: number;
  investigation: GitHubIssueInvestigation | null;
  error?: string;
}

export function BatchReviewWizard({
  open,
  onOpenChange,
  issues,
  selectedNumbers,
  onAnalyze,
  onExecute,
}: BatchReviewWizardProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<WizardStep>("select");
  const [localSelection, setLocalSelection] = useState<Set<number>>(new Set(selectedNumbers));
  const [analysisResults, setAnalysisResults] = useState<Map<number, AnalysisResult>>(new Map());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [executeDone, setExecuteDone] = useState(false);

  const selectedIssues = issues.filter((i) => localSelection.has(i.number));

  // Step 1: Selection handlers
  const handleToggleSelection = useCallback((issueNumber: number) => {
    setLocalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(issueNumber)) {
        next.delete(issueNumber);
      } else {
        next.add(issueNumber);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (localSelection.size === issues.length) {
      setLocalSelection(new Set());
    } else {
      setLocalSelection(new Set(issues.map((i) => i.number)));
    }
  }, [issues, localSelection.size]);

  // Step 2: Analysis - parallelized for better performance
  const handleStartAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setStep("analyze");

    const total = selectedIssues.length;
    let completed = 0;

    // Process analyses in parallel with progress tracking
    const analyzePromises = selectedIssues.map(async (issue) => {
      try {
        const investigation = await onAnalyze(issue.number);
        setAnalysisResults((prev) => {
          const next = new Map(prev);
          next.set(issue.number, { issueNumber: issue.number, investigation });
          return next;
        });
      } catch (error) {
        setAnalysisResults((prev) => {
          const next = new Map(prev);
          next.set(issue.number, {
            issueNumber: issue.number,
            investigation: null,
            error: error instanceof Error ? error.message : "Analysis failed",
          });
          return next;
        });
      }
      // Update progress after each analysis completes
      completed++;
      setAnalyzeProgress(Math.round((completed / total) * 100));
    });

    await Promise.all(analyzePromises);

    setAnalyzing(false);
    setStep("review");
  }, [selectedIssues, onAnalyze]);

  // Step 3: Execute
  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setStep("execute");

    try {
      await onExecute(Array.from(localSelection));
      setExecuteDone(true);
    } catch (error) {
      console.error("Batch execution failed:", error);
    }

    setExecuting(false);
  }, [localSelection, onExecute]);

  // Navigation
  const handleBack = useCallback(() => {
    switch (step) {
      case "analyze":
        if (!analyzing) {
          setStep("select");
        }
        break;
      case "review":
        setStep("select");
        break;
      case "execute":
        if (!executing) {
          setStep("review");
        }
        break;
    }
  }, [step, analyzing, executing]);

  const handleClose = useCallback(() => {
    setStep("select");
    setLocalSelection(new Set(selectedNumbers));
    setAnalysisResults(new Map());
    setAnalyzeProgress(0);
    setExecuteDone(false);
    onOpenChange(false);
  }, [selectedNumbers, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("workspaceSettings.github.batchWizard.title", "Batch Issue Processing")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "workspaceSettings.github.batchWizard.description",
              "Analyze and process multiple issues at once"
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          <StepIndicator
            step={1}
            label={t("workspaceSettings.github.batchWizard.stepSelect", "Select")}
            active={step === "select"}
            completed={step !== "select"}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={2}
            label={t("workspaceSettings.github.batchWizard.stepAnalyze", "Analyze")}
            active={step === "analyze"}
            completed={step === "review" || step === "execute"}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={3}
            label={t("workspaceSettings.github.batchWizard.stepReview", "Review")}
            active={step === "review"}
            completed={step === "execute"}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            step={4}
            label={t("workspaceSettings.github.batchWizard.stepExecute", "Execute")}
            active={step === "execute"}
            completed={executeDone}
          />
        </div>

        <ScrollArea className="max-h-[50vh]">
          {/* Step 1: Select Issues */}
          {step === "select" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {localSelection.size} {t("common.selected")}
                </span>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {localSelection.size === issues.length
                    ? t("common.deselectAll", "Deselect All")
                    : t("common.selectAll", "Select All")}
                </Button>
              </div>
              <div className="divide-y divide-border border rounded-lg">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                      localSelection.has(issue.number) && "bg-primary/5"
                    )}
                    onClick={() => handleToggleSelection(issue.number)}
                  >
                    <Checkbox checked={localSelection.has(issue.number)} />
                    <CircleDot
                      className={cn(
                        "h-4 w-4 shrink-0",
                        issue.state === "open" ? "text-green-500" : "text-purple-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        #{issue.number} {issue.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Analyzing */}
          {step === "analyze" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">
                {t("workspaceSettings.github.batchWizard.analyzing", "Analyzing issues...")}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {analysisResults.size} / {selectedIssues.length} {t("common.completed")}
              </p>
              <Progress value={analyzeProgress} className="w-64 h-2" />
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  "workspaceSettings.github.batchWizard.reviewDescription",
                  "Review the analysis results before starting auto-fix"
                )}
              </p>
              <div className="divide-y divide-border border rounded-lg">
                {selectedIssues.map((issue) => {
                  const result = analysisResults.get(issue.number);
                  return (
                    <div key={issue.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          #{issue.number} {issue.title}
                        </span>
                        {result?.investigation ? (
                          <Badge
                            variant="outline"
                            className="bg-green-500/10 text-green-600 border-green-500/30"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t("common.analyzed", "Analyzed")}
                          </Badge>
                        ) : result?.error ? (
                          <Badge
                            variant="outline"
                            className="bg-destructive/10 text-destructive border-destructive/30"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {t("common.error", "Error")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t("common.pending", "Pending")}
                          </Badge>
                        )}
                      </div>
                      {result?.investigation && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>
                            {t("workspaceSettings.github.issues.complexity")}: {result.investigation.complexity}
                          </span>
                          <span>|</span>
                          <span>
                            ~{result.investigation.estimated_files} {t("workspaceSettings.github.issues.estimatedFiles", "files")}
                          </span>
                        </div>
                      )}
                      {result?.error && (
                        <p className="text-xs text-destructive">{result.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Execute */}
          {step === "execute" && (
            <div className="flex flex-col items-center justify-center py-12">
              {executing ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-lg font-medium">
                    {t("workspaceSettings.github.batchWizard.executing", "Starting auto-fix tasks...")}
                  </p>
                </>
              ) : executeDone ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium text-green-600">
                    {t("workspaceSettings.github.batchWizard.done", "Tasks started successfully!")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t(
                      "workspaceSettings.github.batchWizard.doneDescription",
                      "Monitor progress in the queue panel below"
                    )}
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-lg font-medium text-destructive">
                    {t("workspaceSettings.github.batchWizard.failed", "Failed to start tasks")}
                  </p>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {step !== "execute" && (
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
          )}

          {step === "select" && (
            <Button
              onClick={handleStartAnalysis}
              disabled={localSelection.size === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t("workspaceSettings.github.batchWizard.analyzeSelected", "Analyze Selected")}
              {localSelection.size > 0 && ` (${localSelection.size})`}
            </Button>
          )}

          {step === "review" && (
            <>
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("common.back")}
              </Button>
              <Button onClick={handleExecute}>
                <Play className="h-4 w-4 mr-2" />
                {t("workspaceSettings.github.batchWizard.startAutoFix", "Start Auto-Fix")}
              </Button>
            </>
          )}

          {step === "execute" && executeDone && (
            <Button onClick={handleClose}>
              {t("common.done", "Done")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StepIndicatorProps {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ step, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          completed
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary/20 text-primary border border-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span
        className={cn(
          "text-sm",
          active ? "font-medium" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
