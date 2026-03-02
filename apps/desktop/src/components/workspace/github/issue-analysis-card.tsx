/**
 * Issue Analysis Card Component
 *
 * Displays AI analysis results for a GitHub issue.
 */

import { useTranslation } from "react-i18next";
import {
  Bug,
  Lightbulb,
  Wrench,
  FileText,
  Code2,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Target,
  Folder,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueAnalysis } from "@/stores/github-store";

interface IssueAnalysisCardProps {
  analysis: IssueAnalysis;
}

// Type icons mapping
const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  enhancement: Wrench,
  docs: FileText,
  refactor: Code2,
};

// Type colors mapping
const typeColors = {
  bug: "bg-red-500/10 text-red-600 border-red-500/30",
  feature: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  enhancement: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  docs: "bg-green-500/10 text-green-600 border-green-500/30",
  refactor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

// Complexity colors mapping
const complexityColors = {
  trivial: "bg-green-500/10 text-green-600 border-green-500/30",
  low: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  critical: "bg-red-500/10 text-red-600 border-red-500/30",
};

export function IssueAnalysisCard({ analysis }: IssueAnalysisCardProps) {
  const { t } = useTranslation();

  const TypeIcon = typeIcons[analysis.type] || Bug;

  return (
    <div className="space-y-6">
      {/* Header badges */}
      <div className="flex flex-wrap gap-2">
        {/* Type badge */}
        <Badge
          variant="outline"
          className={cn("flex items-center gap-1.5 px-2.5 py-1", typeColors[analysis.type])}
        >
          <TypeIcon className="h-3.5 w-3.5" />
          {t(`workspaceSettings.github.analysis.type.${analysis.type}`, analysis.type)}
        </Badge>

        {/* Complexity badge */}
        <Badge
          variant="outline"
          className={cn("px-2.5 py-1", complexityColors[analysis.complexity])}
        >
          {t(`workspaceSettings.github.analysis.complexity.${analysis.complexity}`, analysis.complexity)}
        </Badge>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <Target className="h-4 w-4" />
          {t("workspaceSettings.github.analysis.summary", "Summary")}
        </h4>
        <p className="text-sm">{analysis.summary}</p>
      </div>

      {/* Requirements */}
      {analysis.requirements.length > 0 && (
        <AnalysisSection
          icon={CheckCircle2}
          title={t("workspaceSettings.github.analysis.requirements", "Requirements")}
          items={analysis.requirements}
        />
      )}

      {/* Acceptance Criteria */}
      {analysis.acceptanceCriteria.length > 0 && (
        <AnalysisSection
          icon={Target}
          title={t("workspaceSettings.github.analysis.acceptanceCriteria", "Acceptance Criteria")}
          items={analysis.acceptanceCriteria}
          variant="numbered"
        />
      )}

      {/* Affected Areas */}
      {analysis.affectedAreas.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Folder className="h-4 w-4" />
            {t("workspaceSettings.github.analysis.affectedAreas", "Affected Areas")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.affectedAreas.map((area, index) => (
              <Badge key={index} variant="secondary" className="font-mono text-xs">
                {area}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Labels */}
      {analysis.suggestedLabels.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t("workspaceSettings.github.analysis.suggestedLabels", "Suggested Labels")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.suggestedLabels.map((label, index) => (
              <Badge key={index} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Files */}
      {analysis.estimatedFiles.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("workspaceSettings.github.analysis.estimatedFiles", "Estimated Files")}
            <Badge variant="secondary" className="ml-auto">
              {analysis.estimatedFiles.length}
            </Badge>
          </h4>
          <ul className="space-y-1">
            {analysis.estimatedFiles.map((file, index) => (
              <li key={index} className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <Code2 className="h-3 w-3" />
                {file}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {analysis.risks.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h4 className="text-sm font-medium text-amber-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t("workspaceSettings.github.analysis.risks", "Risks")}
          </h4>
          <ul className="space-y-2">
            {analysis.risks.map((risk, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">-</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Investigation hints (from original data) */}
      {analysis.investigation?.implementation_hints && analysis.investigation.implementation_hints.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h4 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {t("workspaceSettings.github.issues.implementationHints", "Implementation Hints")}
          </h4>
          <ul className="space-y-2">
            {analysis.investigation.implementation_hints.map((hint, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5">{index + 1}.</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper component for list sections
interface AnalysisSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  variant?: "bullet" | "numbered";
}

function AnalysisSection({ icon: Icon, title, items, variant = "bullet" }: AnalysisSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="text-sm flex items-start gap-2">
            {variant === "numbered" ? (
              <span className="text-muted-foreground shrink-0 w-5">{index + 1}.</span>
            ) : (
              <span className="text-muted-foreground mt-0.5">-</span>
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
