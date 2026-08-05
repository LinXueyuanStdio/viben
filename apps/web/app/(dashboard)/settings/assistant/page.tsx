"use client";

import { useTranslation } from "react-i18next";
import { usePreferencesSectionState } from "./preferences-section";
import { ModelVariantsSection } from "./model-variants-section";
import { ModelPreferencesSection } from "./preferences-section";
import { SkillsSection } from "./skills-section";

export default function AssistantSettingsPage() {
  const { t } = useTranslation();
  const state = usePreferencesSectionState();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("settings.assistant.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.assistant.description")}
        </p>
      </div>

      <ModelPreferencesSection
        loading={state.loading}
        defaultModelOptions={state.defaultModelOptions}
        selectedDefaultModelId={state.selectedDefaultModelId}
        selectedSubagentModelId={state.selectedSubagentModelId}
        subagentModelOptions={state.subagentModelOptions}
        modelOptions={state.modelOptions}
        modelOptionsLoading={state.modelOptionsLoading}
        enabledModelIds={state.enabledModelIds}
        isSaving={state.isSaving}
        onModelChange={state.handleModelChange}
        onSubagentModelChange={state.handleSubagentModelChange}
        onAddModel={state.handleAddModel}
        onRemoveModel={state.handleRemoveModel}
        onSetEnabledModels={state.handleSetEnabledModels}
      />

      <div className="border-t border-border/50" />

      <ModelVariantsSection />

      <div className="border-t border-border/50" />

      <SkillsSection
        loading={state.loading}
        preferences={state.preferences}
        isSaving={state.isSaving}
        globalSkillSource={state.globalSkillSource}
        onGlobalSkillSourceChange={state.setGlobalSkillSource}
        globalSkillName={state.globalSkillName}
        onGlobalSkillNameChange={state.setGlobalSkillName}
        globalSkillsError={state.globalSkillsError}
        onAddGlobalSkillRef={state.handleAddGlobalSkillRef}
        onRemoveGlobalSkillRef={state.handleRemoveGlobalSkillRef}
      />
    </div>
  );
}
