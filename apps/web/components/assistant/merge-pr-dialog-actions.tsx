import { ExternalLink, GitCompare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type MergePrDialogActionsProps = {
  canViewDiff: boolean;
  canOpenPullRequest: boolean;
  onOpenPullRequest: () => void;
  onViewDiff?: () => void;
};

export function MergePrDialogActions({
  canViewDiff,
  canOpenPullRequest,
  onOpenPullRequest,
  onViewDiff,
}: MergePrDialogActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpenPullRequest}
        disabled={!canOpenPullRequest}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {t("assistant.git.viewPr")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onViewDiff}
        disabled={!canViewDiff || !onViewDiff}
      >
        <GitCompare className="mr-2 h-4 w-4" />
        {t("assistant.git.viewDiff")}
      </Button>
    </div>
  );
}
