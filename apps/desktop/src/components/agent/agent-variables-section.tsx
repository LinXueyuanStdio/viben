/**
 * Agent Variables Section Component
 *
 * Displays and manages three types of variables for agent configuration:
 * 1. Predefined Variables - System variables with resolved values
 * 2. Custom Variables - User-defined variables with default values
 * 3. Environment Variables - References to system env vars with status
 */
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Variable,
  Settings2,
  Key,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface CustomVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}

export interface AgentVariablesSectionProps {
  // Context for predefined variable values
  workspaceName: string;
  workspacePath: string;
  agentName: string;

  // Custom variables
  customVariables: CustomVariable[];
  onCustomVariablesChange: (vars: CustomVariable[]) => void;

  // Environment variable references
  envVariables: string[];
  onEnvVariablesChange: (vars: string[]) => void;

  // Optional className for styling
  className?: string;
}

// ============================================================================
// Predefined Variables Definition
// ============================================================================

interface PredefinedVariable {
  name: string;
  descriptionKey: string;
  getValue: (context: {
    workspaceName: string;
    workspacePath: string;
    agentName: string;
  }) => string;
}

const PREDEFINED_VARIABLES: PredefinedVariable[] = [
  {
    name: "workspace_name",
    descriptionKey: "agentVariables.workspaceNameDesc",
    getValue: (ctx) => ctx.workspaceName || "N/A",
  },
  {
    name: "workspace_path",
    descriptionKey: "agentVariables.workspacePathDesc",
    getValue: (ctx) => ctx.workspacePath || "N/A",
  },
  {
    name: "agent_name",
    descriptionKey: "agentVariables.agentNameDesc",
    getValue: (ctx) => ctx.agentName || "N/A",
  },
  {
    name: "current_date",
    descriptionKey: "agentVariables.currentDateDesc",
    getValue: () => new Date().toISOString().split("T")[0],
  },
  {
    name: "current_time",
    descriptionKey: "agentVariables.currentTimeDesc",
    getValue: () => new Date().toLocaleTimeString(),
  },
  {
    name: "current_datetime",
    descriptionKey: "agentVariables.currentDatetimeDesc",
    getValue: () => new Date().toISOString(),
  },
  {
    name: "current_year",
    descriptionKey: "agentVariables.currentYearDesc",
    getValue: () => new Date().getFullYear().toString(),
  },
  {
    name: "current_month",
    descriptionKey: "agentVariables.currentMonthDesc",
    getValue: () => (new Date().getMonth() + 1).toString().padStart(2, "0"),
  },
  {
    name: "current_day",
    descriptionKey: "agentVariables.currentDayDesc",
    getValue: () => new Date().getDate().toString().padStart(2, "0"),
  },
];

// ============================================================================
// Collapsible Subsection Component
// ============================================================================

interface SubsectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Subsection({
  title,
  icon,
  count,
  action,
  defaultOpen = false,
  children,
}: SubsectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 py-2.5 px-3 text-sm rounded-lg transition-colors",
            "hover:bg-muted/50",
            isOpen && "text-foreground bg-muted/30",
            !isOpen && "text-muted-foreground"
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="shrink-0">{icon}</span>
          <span className="font-medium flex-1 text-left">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5">
              {count}
            </Badge>
          )}
          {action && (
            <span
              className="ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              {action}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-9 pr-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Add Custom Variable Dialog
// ============================================================================

interface AddCustomVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variable: CustomVariable) => void;
  existingNames: string[];
}

function AddCustomVariableDialog({
  open,
  onOpenChange,
  onAdd,
  existingNames,
}: AddCustomVariableDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDefaultValue("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const validateName = useCallback(
    (value: string): string | null => {
      if (!value.trim()) {
        return t("agentVariables.nameRequired", "Variable name is required");
      }
      // Variable name should be alphanumeric with underscores
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
        return t(
          "agentVariables.invalidName",
          "Name must start with letter/underscore and contain only letters, numbers, underscores"
        );
      }
      if (existingNames.includes(value)) {
        return t("agentVariables.duplicateName", "Variable name already exists");
      }
      // Check against predefined variables
      if (PREDEFINED_VARIABLES.some((v) => v.name === value)) {
        return t(
          "agentVariables.reservedName",
          "This name is reserved for predefined variables"
        );
      }
      return null;
    },
    [existingNames, t]
  );

  const handleSubmit = () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    onAdd({
      name: name.trim(),
      defaultValue: defaultValue.trim() || undefined,
      description: description.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Variable className="h-5 w-5 text-primary" />
            {t("agentVariables.addCustomVariable", "Add Custom Variable")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "agentVariables.addCustomVariableDesc",
              "Define a custom variable that can be used in prompts with {{variable_name}} syntax."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="var-name" className="text-sm font-medium">
              {t("agentVariables.variableName", "Variable Name")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="var-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={t("agent.variablePlaceholder", "my_variable")}
              className={cn(error && "border-destructive")}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                "agentVariables.nameHint",
                "Use in prompts as {{my_variable}}"
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="var-default" className="text-sm font-medium">
              {t("agentVariables.defaultValue", "Default Value")}
            </Label>
            <Input
              id="var-default"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={t("agentVariables.defaultValuePlaceholder", "Optional default value")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="var-desc" className="text-sm font-medium">
              {t("agentVariables.description", "Description")}
            </Label>
            <Input
              id="var-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("agentVariables.descriptionPlaceholder", "Optional description")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Add Environment Variable Dialog
// ============================================================================

interface AddEnvVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
  existingNames: string[];
}

function AddEnvVariableDialog({
  open,
  onOpenChange,
  onAdd,
  existingNames,
}: AddEnvVariableDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const validateName = useCallback(
    (value: string): string | null => {
      if (!value.trim()) {
        return t("agentVariables.envNameRequired", "Environment variable name is required");
      }
      // Env variable names are typically uppercase with underscores
      if (!/^[A-Z_][A-Z0-9_]*$/.test(value)) {
        return t(
          "agentVariables.invalidEnvName",
          "Name should be UPPER_SNAKE_CASE (letters, numbers, underscores)"
        );
      }
      if (existingNames.includes(value)) {
        return t("agentVariables.duplicateEnvName", "Environment variable already added");
      }
      return null;
    },
    [existingNames, t]
  );

  const handleSubmit = () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    onAdd(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            {t("agentVariables.addEnvVariable", "Add Environment Variable Reference")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "agentVariables.addEnvVariableDesc",
              "Reference an environment variable that will be resolved at runtime."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="env-name" className="text-sm font-medium">
              {t("agentVariables.envVariableName", "Environment Variable Name")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="env-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder={t("agent.apiKeyPlaceholder", "MY_API_KEY")}
              className={cn(error && "border-destructive")}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                "agentVariables.envNameHint",
                "Use in prompts as {{env.MY_API_KEY}}"
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentVariablesSection({
  workspaceName,
  workspacePath,
  agentName,
  customVariables,
  onCustomVariablesChange,
  envVariables,
  onEnvVariablesChange,
  className,
}: AgentVariablesSectionProps) {
  const { t } = useTranslation();
  const [showAllPredefined, setShowAllPredefined] = useState(false);
  const [addCustomDialogOpen, setAddCustomDialogOpen] = useState(false);
  const [addEnvDialogOpen, setAddEnvDialogOpen] = useState(false);

  // Context for predefined variables
  const variableContext = useMemo(
    () => ({
      workspaceName,
      workspacePath,
      agentName,
    }),
    [workspaceName, workspacePath, agentName]
  );

  // Predefined variables with resolved values
  const predefinedWithValues = useMemo(
    () =>
      PREDEFINED_VARIABLES.map((v) => ({
        ...v,
        value: v.getValue(variableContext),
      })),
    [variableContext]
  );

  // Display subset or all predefined variables
  const displayedPredefined = showAllPredefined
    ? predefinedWithValues
    : predefinedWithValues.slice(0, 4);

  // Handle custom variable deletion
  const handleDeleteCustomVariable = useCallback(
    (name: string) => {
      onCustomVariablesChange(customVariables.filter((v) => v.name !== name));
    },
    [customVariables, onCustomVariablesChange]
  );

  // Handle custom variable addition
  const handleAddCustomVariable = useCallback(
    (variable: CustomVariable) => {
      onCustomVariablesChange([...customVariables, variable]);
    },
    [customVariables, onCustomVariablesChange]
  );

  // Handle env variable deletion
  const handleDeleteEnvVariable = useCallback(
    (name: string) => {
      onEnvVariablesChange(envVariables.filter((v) => v !== name));
    },
    [envVariables, onEnvVariablesChange]
  );

  // Handle env variable addition
  const handleAddEnvVariable = useCallback(
    (name: string) => {
      onEnvVariablesChange([...envVariables, name]);
    },
    [envVariables, onEnvVariablesChange]
  );

  // Check if env variable is set (this runs in browser context)
  // Note: In Tauri/Electron, we might need to call native API to check env vars
  // For now, we'll show as "unknown" since browser can't access process.env
  const getEnvStatus = useCallback((_name: string): "set" | "not_set" | "unknown" => {
    // In browser context, we can't directly access process.env
    // This would need to be checked via Tauri command or passed as props
    return "unknown";
  }, []);

  return (
    <div className={cn("space-y-1", className)}>
      {/* Section Header */}
      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider px-3">
        {t("agentVariables.sectionTitle", "Variables")}
      </h4>

      {/* ================================================================
          1. Predefined Variables
          ================================================================ */}
      <Subsection
        title={t("agentVariables.predefinedVariables", "Predefined Variables")}
        icon={<Variable className="h-4 w-4" />}
        count={PREDEFINED_VARIABLES.length}
        defaultOpen
      >
        <div className="space-y-2 pt-2">
          {displayedPredefined.map((variable) => (
            <div
              key={variable.name}
              className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge
                  variant="outline"
                  className="text-xs font-mono shrink-0"
                >
                  {`{{${variable.name}}}`}
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground truncate cursor-help">
                        {t(variable.descriptionKey, variable.name)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t(variable.descriptionKey, variable.name)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 ml-2 max-w-[120px] truncate">
                {variable.value}
              </code>
            </div>
          ))}

          {PREDEFINED_VARIABLES.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => setShowAllPredefined(!showAllPredefined)}
            >
              {showAllPredefined
                ? t("agentVariables.showLess", "Show less")
                : t("agentVariables.showAll", "Show all {{count}}", {
                    count: PREDEFINED_VARIABLES.length,
                  })}
            </Button>
          )}
        </div>
      </Subsection>

      {/* ================================================================
          2. Custom Variables
          ================================================================ */}
      <Subsection
        title={t("agentVariables.customVariables", "Custom Variables")}
        icon={<Settings2 className="h-4 w-4" />}
        count={customVariables.length}
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setAddCustomDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
        defaultOpen={customVariables.length > 0}
      >
        <div className="space-y-2 pt-2">
          {customVariables.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">
                {t(
                  "agentVariables.noCustomVariables",
                  "No custom variables defined"
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setAddCustomDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t("agentVariables.addVariable", "Add Variable")}
              </Button>
            </div>
          ) : (
            <>
              {customVariables.map((variable) => (
                <div
                  key={variable.name}
                  className="flex items-center justify-between py-2 px-2 rounded-md border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono shrink-0"
                      >
                        {`{{${variable.name}}}`}
                      </Badge>
                      {variable.defaultValue && (
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[100px]">
                          {variable.defaultValue}
                        </code>
                      )}
                    </div>
                    {variable.description && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {variable.description}
                      </p>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCustomVariable(variable.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("common.delete")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </>
          )}
        </div>
      </Subsection>

      {/* ================================================================
          3. Environment Variables
          ================================================================ */}
      <Subsection
        title={t("agentVariables.envVariables", "Environment Variables")}
        icon={<Key className="h-4 w-4" />}
        count={envVariables.length}
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setAddEnvDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
        defaultOpen={envVariables.length > 0}
      >
        <div className="space-y-2 pt-2">
          {envVariables.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">
                {t(
                  "agentVariables.noEnvVariables",
                  "No environment variable references"
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setAddEnvDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t("agentVariables.addEnvRef", "Add Reference")}
              </Button>
            </div>
          ) : (
            <>
              {envVariables.map((envName) => {
                const status = getEnvStatus(envName);
                return (
                  <div
                    key={envName}
                    className="flex items-center justify-between py-2 px-2 rounded-md border bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono shrink-0"
                      >
                        {`{{env.${envName}}}`}
                      </Badge>
                      {/* Status indicator */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0",
                                status === "set" &&
                                  "bg-green-500/10 text-green-600 dark:text-green-400",
                                status === "not_set" &&
                                  "bg-red-500/10 text-red-600 dark:text-red-400",
                                status === "unknown" &&
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {status === "set" && (
                                <>
                                  <Check className="h-3 w-3" />
                                  {t("agentVariables.envSet", "Set")}
                                </>
                              )}
                              {status === "not_set" && (
                                <>
                                  <X className="h-3 w-3" />
                                  {t("agentVariables.envNotSet", "Not set")}
                                </>
                              )}
                              {status === "unknown" && (
                                <>
                                  <EyeOff className="h-3 w-3" />
                                  {t("agentVariables.envUnknown", "Runtime")}
                                </>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {status === "set" &&
                              t(
                                "agentVariables.envSetTooltip",
                                "This environment variable is set in the system"
                              )}
                            {status === "not_set" &&
                              t(
                                "agentVariables.envNotSetTooltip",
                                "This environment variable is not set"
                              )}
                            {status === "unknown" &&
                              t(
                                "agentVariables.envUnknownTooltip",
                                "Will be resolved at runtime by the agent executor"
                              )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteEnvVariable(envName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("common.delete")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </Subsection>

      {/* Dialogs */}
      <AddCustomVariableDialog
        open={addCustomDialogOpen}
        onOpenChange={setAddCustomDialogOpen}
        onAdd={handleAddCustomVariable}
        existingNames={customVariables.map((v) => v.name)}
      />

      <AddEnvVariableDialog
        open={addEnvDialogOpen}
        onOpenChange={setAddEnvDialogOpen}
        onAdd={handleAddEnvVariable}
        existingNames={envVariables}
      />
    </div>
  );
}
