// apps/desktop/src/pages/settings/pet-section/preferences-form.tsx
import type { PetConfigResponse } from "./api";

interface PreferencesFormProps {
  config: PetConfigResponse;
  onChange: (updates: Partial<PetConfigResponse>) => void;
}

export function PreferencesForm({ config, onChange }: PreferencesFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">大小</label>
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
