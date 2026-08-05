"use client";

import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Boxes,
  ChevronRight,
  Code2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ModelCombobox } from "@/components/assistant/model-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type AvailableModel, getModelDisplayName } from "@/lib/models";
import {
  isBuiltInVariant,
  providerOptionsSchema,
  type JsonValue,
  type ModelVariant,
} from "@/lib/model-variants";
import { fetcher } from "@/lib/swr";

interface ModelsResponse {
  models: AvailableModel[];
}

interface ModelVariantsResponse {
  modelVariants: ModelVariant[];
}

const EMPTY_MODELS: AvailableModel[] = [];
const EMPTY_MODEL_VARIANTS: ModelVariant[] = [];

function parseProviderOptions(
  input: string,
):
  | { success: true; data: Record<string, JsonValue> }
  | { success: false; error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input || "{}");
  } catch {
    return { success: false, error: "Provider options must be valid JSON" };
  }

  const validated = providerOptionsSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      success: false,
      error: "Provider options must be a JSON object",
    };
  }

  return { success: true, data: validated.data };
}

export function ModelVariantsSectionSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("settings.assistant.variants.modelVariants")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.assistant.variants.modelVariantsDesc")}
        </p>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

function VariantFormDialog({
  open,
  onOpenChange,
  editingVariant,
  models,
  modelItems,
  isSaving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVariant: ModelVariant | null;
  models: AvailableModel[];
  modelItems: Array<{ id: string; label: string }>;
  isSaving: boolean;
  onSubmit: (data: {
    name: string;
    baseModelId: string;
    providerOptionsText: string;
  }) => Promise<true | string>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [baseModelId, setBaseModelId] = useState("");
  const [providerOptionsText, setProviderOptionsText] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingVariant) {
        setName(editingVariant.name);
        setBaseModelId(editingVariant.baseModelId);
        setProviderOptionsText(
          JSON.stringify(editingVariant.providerOptions, null, 2),
        );
      } else {
        setName("");
        setBaseModelId(models[0]?.id ?? "");
        setProviderOptionsText("{}");
      }
      setError(null);
    }
  }, [open, editingVariant, models]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError(t("settings.assistant.variants.nameRequired"));
      return;
    }

    if (!baseModelId) {
      setError(t("settings.assistant.variants.baseModelRequired"));
      return;
    }

    const parsedProviderOptions = parseProviderOptions(providerOptionsText);
    if (!parsedProviderOptions.success) {
      setError(parsedProviderOptions.error);
      return;
    }

    setError(null);
    const result = await onSubmit({ name, baseModelId, providerOptionsText });
    if (result === true) {
      onOpenChange(false);
    } else {
      setError(result);
    }
  };

  const isEditing = editingVariant !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("settings.assistant.variants.editVariant") : t("settings.assistant.variants.newVariant")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("settings.assistant.variants.editVariantDesc")
              : t("settings.assistant.variants.newVariantDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="variant-name" className="text-xs font-medium">
              {t("settings.assistant.variants.name")}
            </Label>
            <Input
              id="variant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("settings.assistant.variants.namePlaceholder")}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="base-model" className="text-xs font-medium">
              {t("settings.assistant.variants.baseModel")}
            </Label>
            <ModelCombobox
              value={baseModelId}
              items={modelItems}
              placeholder={t("settings.assistant.variants.baseModelPlaceholder")}
              searchPlaceholder={t("settings.assistant.variants.baseModelSearchPlaceholder")}
              emptyText={t("settings.assistant.variants.baseModelEmptyText")}
              disabled={isSaving}
              onChange={setBaseModelId}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-options" className="text-xs font-medium">
              {t("settings.assistant.variants.providerOptions")}
            </Label>
            <Textarea
              id="provider-options"
              value={providerOptionsText}
              onChange={(event) => setProviderOptionsText(event.target.value)}
              className="min-h-28 resize-y rounded-md border-border bg-muted/30 font-mono text-xs leading-relaxed"
              placeholder={t("settings.assistant.variants.providerOptionsPlaceholder")}
              disabled={isSaving}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("settings.assistant.variants.providerOptionsHint")}
            </p>
            <a
              href="https://ai-sdk.dev/docs/foundations/provider-options"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("settings.assistant.variants.viewProviderDocs")}
              <ExternalLink className="size-3" />
            </a>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("settings.assistant.variants.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving
                ? t("settings.assistant.variants.saving")
                : isEditing
                  ? t("settings.assistant.variants.saveChanges")
                  : t("settings.assistant.variants.createVariant")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantCard({
  variant,
  modelName,
  builtIn,
  isSaving,
  onEdit,
  onDelete,
}: {
  variant: ModelVariant;
  modelName: string;
  builtIn: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const optionKeys = Object.keys(variant.providerOptions);
  const hasOptions = optionKeys.length > 0;

  return (
    <div className="group relative rounded-lg border border-border bg-card transition-colors hover:border-border/80 hover:bg-accent/30">
      <div className="flex items-start gap-3 p-3.5">
        {/* Icon */}
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/70">
          <Boxes className="size-3.5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium leading-tight">
              {variant.name}
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="truncate text-xs text-muted-foreground">
              {modelName}
            </span>
            {hasOptions && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Code2 className="size-3" />
                  {t(optionKeys.length === 1 ? "settings.assistant.variants.optionCount_one" : "settings.assistant.variants.optionCount", { count: optionKeys.length })}
                </span>
              </>
            )}
          </div>

          {/* Options preview */}
          {hasOptions && (
            <div className="mt-2 flex flex-wrap gap-1">
              {optionKeys.slice(0, 4).map((key) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex max-w-[180px] items-center truncate rounded-sm bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {key}
                      <ChevronRight className="ml-0.5 inline size-2.5 opacity-40" />
                      <span className="opacity-70">
                        {String(variant.providerOptions[key])}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="font-mono text-xs">
                      {key}: {JSON.stringify(variant.providerOptions[key])}
                    </span>
                  </TooltipContent>
                </Tooltip>
              ))}
              {optionKeys.length > 4 && (
                <span className="inline-flex items-center rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t("settings.assistant.variants.moreOptions", { count: optionKeys.length - 4 })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {builtIn ? (
          <span className="shrink-0 rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t("settings.assistant.variants.builtIn")}
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
                  disabled={isSaving}
                  className="size-7"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("settings.assistant.variants.editVariantTooltip")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={isSaving}
                  className="size-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("settings.assistant.variants.deleteVariantTooltip")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export function ModelVariantsSection() {
  const { t } = useTranslation();
  const { data: modelsData, isLoading: modelsLoading } = useSWR<ModelsResponse>(
    "/api/models",
    fetcher,
  );
  const {
    data: variantsData,
    isLoading: variantsLoading,
    mutate,
  } = useSWR<ModelVariantsResponse>("/api/settings/model-variants", fetcher);

  const models = modelsData?.models ?? EMPTY_MODELS;
  const modelVariants = variantsData?.modelVariants ?? EMPTY_MODEL_VARIANTS;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ModelVariant | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelItems = useMemo(
    () =>
      models.map((model) => ({
        id: model.id,
        label: getModelDisplayName(model),
      })),
    [models],
  );

  const modelNameById = useMemo(
    () =>
      new Map(models.map((model) => [model.id, getModelDisplayName(model)])),
    [models],
  );

  const handleOpenCreate = () => {
    setEditingVariant(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (variant: ModelVariant) => {
    setEditingVariant(variant);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: {
    name: string;
    baseModelId: string;
    providerOptionsText: string;
  }): Promise<true | string> => {
    const parsedProviderOptions = parseProviderOptions(
      data.providerOptionsText,
    );
    if (!parsedProviderOptions.success) {
      return parsedProviderOptions.error;
    }

    setIsSaving(true);
    setError(null);

    try {
      const method = editingVariant ? "PATCH" : "POST";
      const body = editingVariant
        ? {
            id: editingVariant.id,
            name: data.name.trim(),
            baseModelId: data.baseModelId,
            providerOptions: parsedProviderOptions.data,
          }
        : {
            name: data.name.trim(),
            baseModelId: data.baseModelId,
            providerOptions: parsedProviderOptions.data,
          };

      const response = await fetch("/api/settings/model-variants", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseData = (await response.json()) as
        | ModelVariantsResponse
        | { error?: string };

      if (!response.ok) {
        const message =
          "error" in responseData
            ? responseData.error
            : t("settings.assistant.variants.failedToSave");
        return message ?? t("settings.assistant.variants.failedToSave");
      }

      if (!("modelVariants" in responseData)) {
        return t("settings.assistant.variants.failedToSave");
      }

      const nextVariants = responseData.modelVariants;
      await mutate({ modelVariants: nextVariants }, { revalidate: false });
      return true;
    } catch (submitError) {
      console.error("Failed to save model variant:", submitError);
      return t("settings.assistant.variants.failedToSave");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!window.confirm(t("settings.assistant.variants.deleteConfirm"))) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/model-variants", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: variantId }),
      });

      const responseData = (await response.json()) as
        | ModelVariantsResponse
        | { error?: string };

      if (!response.ok) {
        const message =
          "error" in responseData
            ? responseData.error
            : t("settings.assistant.variants.failedToDelete");
        setError(message ?? t("settings.assistant.variants.failedToDelete"));
        return;
      }

      if (!("modelVariants" in responseData)) {
        setError(t("settings.assistant.variants.failedToDelete"));
        return;
      }

      const nextVariants = responseData.modelVariants;
      await mutate({ modelVariants: nextVariants }, { revalidate: false });
    } catch (deleteError) {
      console.error("Failed to delete model variant:", deleteError);
      setError(t("settings.assistant.variants.failedToDelete"));
    } finally {
      setIsSaving(false);
    }
  };

  if (modelsLoading || variantsLoading) {
    return <ModelVariantsSectionSkeleton />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("settings.assistant.variants.modelVariants")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings.assistant.variants.modelVariantsDesc")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            disabled={isSaving}
            className="shrink-0"
          >
            <Plus className="size-3.5" />
            {t("settings.assistant.variants.newVariant")}
          </Button>
        </div>
        <div>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            {modelVariants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                modelName={
                  modelNameById.get(variant.baseModelId) ?? variant.baseModelId
                }
                builtIn={isBuiltInVariant(variant.id)}
                isSaving={isSaving}
                onEdit={() => handleOpenEdit(variant)}
                onDelete={() => handleDelete(variant.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <VariantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingVariant={editingVariant}
        models={models}
        modelItems={modelItems}
        isSaving={isSaving}
        onSubmit={handleSubmit}
      />
    </>
  );
}
