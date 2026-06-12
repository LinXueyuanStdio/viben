// apps/desktop/src/pages/settings/pet-section/preferences-form.tsx
import { useTranslation } from "react-i18next";
import type { PetConfigResponse } from "./api";

interface PreferencesFormProps {
  config: PetConfigResponse;
  onChange: (updates: Partial<PetConfigResponse>) => void;
}

export function PreferencesForm({ config, onChange }: PreferencesFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{t("settings.pet.size", "Size")}</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={48}
            max={192}
            value={config.preferences.size}
            onChange={(e) =>
              onChange({
                preferences: { ...config.preferences, size: Number(e.target.value) },
              })
            }
            className="w-32"
          />
          <span className="text-sm text-muted-foreground w-12">{config.preferences.size}px</span>
        </div>
      </div>
    </div>
  );
}
