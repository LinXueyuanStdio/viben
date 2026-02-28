import * as React from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreationMethod = "open-existing" | "create-new";

interface StepChooseMethodProps {
  onSelect: (method: CreationMethod) => void;
}

/**
 * Step 1: Choose workspace creation method
 * - Open existing folder
 * - Create new folder
 */
export function StepChooseMethod({ onSelect }: StepChooseMethodProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <MethodCard
        icon={<FolderOpen className="h-6 w-6" />}
        title={t("workspace.addModal.methodOpenExisting")}
        description={t("workspace.addModal.methodOpenExistingDesc")}
        onClick={() => onSelect("open-existing")}
      />
      <MethodCard
        icon={<Plus className="h-6 w-6" />}
        title={t("workspace.addModal.methodCreateNew")}
        description={t("workspace.addModal.methodCreateNewDesc")}
        onClick={() => onSelect("create-new")}
      />
    </div>
  );
}

interface MethodCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function MethodCard({ icon, title, description, onClick }: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-lg border border-border",
        "text-left transition-all duration-200",
        "hover:border-primary/50 hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      <div className="shrink-0 p-2 rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}
