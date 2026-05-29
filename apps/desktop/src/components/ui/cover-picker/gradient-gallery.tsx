import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { GRADIENT_COLORS } from "@/lib/gradient-colors";

const SOLID_COLORS = [
  { key: "warm-gray", color: "#d6d3d1" },
  { key: "slate", color: "#94a3b8" },
  { key: "stone", color: "#a8a29e" },
  { key: "neutral", color: "#a3a3a3" },
] as const;

export interface GradientGalleryProps {
  value?: string | null;
  onSelect: (cover: string) => void;
}

export function GradientGallery({ value, onSelect }: GradientGalleryProps) {
  const { t } = useTranslation();
  const gradientEntries = Object.entries(GRADIENT_COLORS) as [string, { from: string; to: string }][];

  return (
    <div className="p-3 space-y-3">
      {/* Gradients */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-2">{t("coverPicker.colorAndGradient", "Color & Gradient")}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {gradientEntries.map(([key, { from, to }]) => {
            const coverValue = `gradient:${key}`;
            const isSelected = value === coverValue;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(coverValue)}
                className={cn(
                  "h-10 rounded-md cursor-pointer transition-all ring-offset-background",
                  "hover:scale-105 hover:shadow-sm",
                  isSelected && "ring-2 ring-ring ring-offset-1"
                )}
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                title={key}
              />
            );
          })}
          {SOLID_COLORS.map(({ key, color }) => {
            const coverValue = `solid:${key}`;
            const isSelected = value === coverValue;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(coverValue)}
                className={cn(
                  "h-10 rounded-md cursor-pointer transition-all ring-offset-background",
                  "hover:scale-105 hover:shadow-sm",
                  isSelected && "ring-2 ring-ring ring-offset-1"
                )}
                style={{ background: color }}
                title={key}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
