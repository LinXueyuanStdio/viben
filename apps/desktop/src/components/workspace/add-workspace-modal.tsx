import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getGatewayClient, type WorkspaceResponse } from "@/lib/gateway";
import { useWorkspaceStore } from "@/stores";
import { StepChooseMethod, type CreationMethod } from "./steps/step-choose-method";
import { StepConfigure, type FolderStatus, type ConfigureFormData } from "./steps/step-configure";
import { StepComplete, type CreationResult } from "./steps/step-complete";

type WizardStep = "choose" | "configure" | "complete";

interface AddWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wizard modal for creating new workspaces.
 *
 * Steps:
 * 1. Choose method (open existing / create new)
 * 2. Configure settings (name, location, Git/Viben options)
 * 3. Complete (success message + next actions)
 */
export function AddWorkspaceModal({ open, onOpenChange }: AddWorkspaceModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addWorkspaceToStore = useWorkspaceStore((s) => s.addWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  // Wizard state
  const [step, setStep] = React.useState<WizardStep>("choose");
  const [method, setMethod] = React.useState<CreationMethod | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [folderStatus, setFolderStatus] = React.useState<FolderStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [creationResult, setCreationResult] = React.useState<CreationResult | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      // Reset after close animation
      const timer = setTimeout(() => {
        setStep("choose");
        setMethod(null);
        setSelectedPath(null);
        setFolderStatus(null);
        setCreationResult(null);
        setIsSubmitting(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Detect folder status via Gateway API
  const detectFolderStatus = React.useCallback(async (path: string): Promise<FolderStatus> => {
    try {
      const client = getGatewayClient();
      const response = await fetch(`${client["baseUrl"]}/api/workspaces/detect?path=${encodeURIComponent(path)}`);

      if (!response.ok) {
        throw new Error("Failed to detect folder status");
      }

      const data = await response.json();
      return {
        hasGit: data.has_git,
        hasViben: data.has_viben,
        folderName: data.folder_name,
      };
    } catch (err) {
      // Fallback to basic detection if API fails
      console.warn("Failed to detect folder status:", err);
      return {
        hasGit: false,
        hasViben: false,
        folderName: path.split("/").pop() || "",
      };
    }
  }, []);

  // Handle method selection
  const handleMethodSelect = async (selectedMethod: CreationMethod) => {
    setMethod(selectedMethod);

    if (selectedMethod === "open-existing") {
      // Open folder picker immediately
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("workspace.addModal.methodOpenExisting"),
      });

      if (selected && typeof selected === "string") {
        const status = await detectFolderStatus(selected);
        setSelectedPath(selected);
        setFolderStatus(status);
        setStep("configure");
      }
      // If cancelled, stay on choose step
    } else {
      // Create new - go directly to configure
      setStep("configure");
    }
  };

  // Handle path selection in configure step (for existing folders)
  const handlePathSelect = async (path: string) => {
    const status = await detectFolderStatus(path);
    setSelectedPath(path);
    setFolderStatus(status);
  };

  // Handle back navigation
  const handleBack = () => {
    if (step === "configure") {
      setStep("choose");
      setSelectedPath(null);
      setFolderStatus(null);
    }
  };

  // Handle form submission
  const handleSubmit = async (data: ConfigureFormData) => {
    setIsSubmitting(true);

    try {
      const client = getGatewayClient();

      const requestBody = {
        method: method!,
        path: data.path,
        name: data.name,
        init_git: data.initGit,
        init_viben: data.initViben,
        viben_options: data.initViben ? {
          developer_name: data.vibenOptions.developerName,
          project_type: data.vibenOptions.projectType,
          include_cursor: data.vibenOptions.includeCursor,
          force: data.vibenOptions.force,
        } : undefined,
      };

      const response = await fetch(`${client["baseUrl"]}/api/workspaces/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create workspace");
      }

      const result = await response.json();
      const workspace = result.workspace as WorkspaceResponse;

      // Add to store (this updates the sidebar immediately)
      addWorkspaceToStore({
        id: workspace.id,
        path: workspace.path,
        name: workspace.name,
        type: workspace.type || "custom",
        created_at: workspace.created_at || new Date().toISOString(),
        last_accessed: workspace.updated_at || new Date().toISOString(),
      });

      // Set result and go to complete step
      setCreationResult({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspacePath: workspace.path,
        gitInitialized: result.git_initialized,
        vibenInitialized: result.viben_initialized,
        vibenFiles: result.viben_files,
      });
      setStep("complete");
    } catch (err) {
      console.error("Failed to create workspace:", err);
      // TODO: Show error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle go to workspace
  const handleGoToWorkspace = () => {
    if (creationResult) {
      // Select the workspace and navigate
      setActiveWorkspace(creationResult.workspaceId);
      onOpenChange(false);
      navigate(`/workspace/${creationResult.workspaceId}/chat`);
    }
  };

  // Handle continue adding
  const handleContinueAdding = () => {
    setStep("choose");
    setMethod(null);
    setSelectedPath(null);
    setFolderStatus(null);
    setCreationResult(null);
  };

  // Get dialog title based on step
  const getDialogTitle = () => {
    switch (step) {
      case "choose":
        return t("workspace.addModal.title");
      case "configure":
        return method === "create-new"
          ? t("workspace.addModal.titleCreate")
          : t("workspace.addModal.titleConfigure");
      case "complete":
        return t("workspace.addModal.title");
      default:
        return t("workspace.addModal.title");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === "configure" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-2">
          {step === "choose" && (
            <StepChooseMethod onSelect={handleMethodSelect} />
          )}

          {step === "configure" && method && (
            <StepConfigure
              method={method}
              selectedPath={selectedPath}
              folderStatus={folderStatus}
              onPathSelect={handlePathSelect}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          {step === "complete" && creationResult && (
            <StepComplete
              result={creationResult}
              onGoToWorkspace={handleGoToWorkspace}
              onContinueAdding={handleContinueAdding}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
