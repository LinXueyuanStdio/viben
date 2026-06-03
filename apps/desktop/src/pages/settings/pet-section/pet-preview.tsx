// apps/desktop/src/pages/settings/pet-section/pet-preview.tsx
import { PetSprite, STANDARD_ANIMATIONS } from "@viben/pet";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { PetResponse } from "./api";

interface PetPreviewProps {
  pet: PetResponse | null;
  size?: number;
}

function resolveSpritesheet(pet: PetResponse): string {
  const url = pet.spritesheet_url;
  // 相对路径（内置 Pet）直接使用
  if (url.startsWith("/pets/") || url.startsWith("http")) {
    return url;
  }
  // 绝对文件路径（已安装 Pet）使用 Tauri asset 协议
  if (url.startsWith("/")) {
    return convertFileSrc(url);
  }
  return url;
}

export function PetPreview({ pet, size = 96 }: PetPreviewProps) {
  if (!pet) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-muted"
        style={{ width: size, height: size }}
      >
        <span className="text-muted-foreground text-sm">No Pet</span>
      </div>
    );
  }

  const petConfig = {
    id: pet.id,
    name: pet.metadata.display_name,
    description: pet.metadata.description,
    accent: "#f5a623",
    greeting: "",
    spritesheet: resolveSpritesheet(pet),
    atlas: {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    },
  };

  return <PetSprite pet={petConfig} rowId="idle" size={size} />;
}
