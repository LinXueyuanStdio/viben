"use client";

import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelCombobox } from "@/components/assistant/model-combobox";
import { useModelPreferences } from "@/hooks/assistant/use-model-preferences";
import type { ModelOption } from "@/lib/model-options";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function ModelPreferencesSectionSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <SectionHeader>{t("settings.assistant.models.modelPreferences")}</SectionHeader>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <div className="grid gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
        <div className="rounded-lg border border-border/70">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="size-6 rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function ModelPreferencesSection() {
  const { t } = useTranslation();
  const {
    loading,
    defaultModelOptions,
    selectedDefaultModelId,
    selectedSubagentModelId,
    subagentModelOptions,
    modelOptions,
    modelOptionsLoading,
    enabledModelIds,
    isSaving,
    handleModelChange,
    handleSubagentModelChange,
    handleAddModel,
    handleRemoveModel,
    handleSetEnabledModels,
  } = useModelPreferences();

  if (loading) {
    return <ModelPreferencesSectionSkeleton />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader>{t("settings.assistant.models.modelPreferences")}</SectionHeader>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="model">{t("settings.assistant.models.defaultModel")}</Label>
          <ModelCombobox
            value={selectedDefaultModelId}
            items={defaultModelOptions.map((option) => ({
              id: option.id,
              label: option.label,
              description: option.description,
              isVariant: option.isVariant,
            }))}
            placeholder={t("settings.assistant.models.selectModel")}
            searchPlaceholder={t("settings.assistant.models.searchModels")}
            emptyText={modelOptionsLoading ? t("settings.assistant.models.loading") : t("settings.assistant.models.noModelsFound")}
            disabled={isSaving || modelOptionsLoading}
            onChange={handleModelChange}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.models.defaultModelHint")}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subagent-model">{t("settings.assistant.models.subagentModel")}</Label>
          <ModelCombobox
            value={selectedSubagentModelId}
            items={[
              { id: "auto", label: t("settings.assistant.models.sameAsMainModel") },
              ...subagentModelOptions.map((option) => ({
                id: option.id,
                label: option.label,
                description: option.description,
                isVariant: option.isVariant,
              })),
            ]}
            placeholder={t("settings.assistant.models.selectModel")}
            searchPlaceholder={t("settings.assistant.models.searchModels")}
            emptyText={modelOptionsLoading ? t("settings.assistant.models.loading") : t("settings.assistant.models.noModelsFound")}
            disabled={isSaving || modelOptionsLoading}
            onChange={handleSubagentModelChange}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.models.subagentModelHint")}
          </p>
        </div>
      </div>

      <EnabledModelsSection
        modelOptions={modelOptions}
        modelOptionsLoading={modelOptionsLoading}
        enabledModelIds={enabledModelIds}
        onAddModel={handleAddModel}
        onRemoveModel={handleRemoveModel}
        onSetEnabledModels={handleSetEnabledModels}
        disabled={isSaving}
      />
    </div>
  );
}

function EnabledModelsSection({
  modelOptions,
  modelOptionsLoading,
  enabledModelIds,
  onAddModel,
  onRemoveModel,
  onSetEnabledModels,
  disabled,
}: {
  modelOptions: ModelOption[];
  modelOptionsLoading: boolean;
  enabledModelIds: Set<string>;
  onAddModel: (modelId: string) => void;
  onRemoveModel: (modelId: string) => void;
  onSetEnabledModels: (ids: string[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabledCount = enabledModelIds.size;

  const enabledOptions = useMemo(
    () => modelOptions.filter((option) => enabledModelIds.has(option.id)),
    [modelOptions, enabledModelIds],
  );

  const availableOptions = useMemo(() => {
    const opts = modelOptions.filter(
      (option) => !enabledModelIds.has(option.id),
    );
    if (!search.trim()) return opts;
    const lower = search.toLowerCase();
    return opts.filter(
      (option) =>
        option.label.toLowerCase().includes(lower) ||
        option.id.toLowerCase().includes(lower) ||
        (option.description?.toLowerCase().includes(lower) ?? false),
    );
  }, [modelOptions, enabledModelIds, search]);

  const handleDeselectAll = () => {
    onSetEnabledModels([]);
  };

  const handleAdd = (modelId: string) => {
    onAddModel(modelId);
    setSearch("");
    inputRef.current?.focus();
  };

  if (modelOptionsLoading) {
    return (
      <div className="grid gap-2">
        <Label>{t("settings.assistant.models.customModelSet")}</Label>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("settings.assistant.models.customModelSet")}</Label>
          {enabledCount > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleDeselectAll}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40"
            >
              {t("settings.assistant.models.clearAll")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {enabledCount === 0
            ? t("settings.assistant.models.emptyHint")
            : t(enabledCount === 1 ? "settings.assistant.models.hasModelsHint_one" : "settings.assistant.models.hasModelsHint", { count: enabledCount })}
        </p>
      </div>

      {enabledOptions.length > 0 && (
        <div className="divide-y divide-border/60 rounded-lg border border-border/70">
          {enabledOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {option.label}
                  </span>
                  {option.isVariant && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {t("settings.assistant.models.variant")}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {option.id}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemoveModel(option.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
                aria-label={t("settings.assistant.models.removeModel", { label: option.label })}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t("settings.assistant.models.searchPlaceholder")}
            disabled={disabled}
            className="pl-9"
          />
        </div>
        {dropdownOpen && (
          <>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop dismiss */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => {
                setDropdownOpen(false);
                setSearch("");
              }}
            />
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
              <div className="max-h-60 overflow-y-auto">
                {availableOptions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {search.trim()
                      ? t("settings.assistant.models.noMatchingModels")
                      : t("settings.assistant.models.allModelsAdded")}
                  </p>
                ) : (
                  availableOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleAdd(option.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                    >
                      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {option.label}
                          </span>
                          {option.isVariant && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {t("settings.assistant.models.variant")}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {option.description ?? option.id}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
