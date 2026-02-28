import { useTranslation } from "react-i18next";
import { Check, Folder, GitBranch, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CreationResult {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  gitInitialized: boolean;
  vibenInitialized: boolean;
  vibenFiles?: string[];
}

interface StepCompleteProps {
  result: CreationResult;
  onGoToWorkspace: () => void;
  onContinueAdding: () => void;
}

/**
 * Step 3: Show creation success and next actions
 */
export function StepComplete({ result, onGoToWorkspace, onContinueAdding }: StepCompleteProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-center">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <Check className="h-10 w-10 text-green-500" />
        </div>
      </div>

      {/* Success message */}
      <div>
        <h3 className="text-lg font-medium">{t("workspace.addModal.successTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("workspace.addModal.successDesc", { name: result.workspaceName })}
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border bg-muted/30 p-4 text-left space-y-3">
        {/* Path */}
        <div className="flex items-center gap-2 text-sm">
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{result.workspacePath}</span>
        </div>

        {/* Git status */}
        {result.gitInitialized && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            <GitBranch className="h-4 w-4 shrink-0" />
            <span>{t("workspace.addModal.successGitInit")}</span>
          </div>
        )}

        {/* Viben status */}
        {result.vibenInitialized && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            <Settings className="h-4 w-4 shrink-0" />
            <span>{t("workspace.addModal.successVibenInit")}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onContinueAdding}>
          {t("workspace.addModal.btnContinueAdd")}
        </Button>
        <Button onClick={onGoToWorkspace}>
          {t("workspace.addModal.btnGoToWorkspace")}
        </Button>
      </div>
    </div>
  );
}
