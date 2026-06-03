// apps/desktop/src/pages/settings/pet-section/pet-preview.tsx
import { PetSprite, STANDARD_ANIMATIONS } from "@viben/pet";
import type { PetResponse } from "./api";

const API_BASE = "http://127.0.0.1:18790";

interface PetPreviewProps {
  pet: PetResponse | null;
  size?: number;
}

function resolveSpritesheet(pet: PetResponse): string {
  const url = pet.spritesheet_url;
  // 相对路径（内置 Pet 从 public/pets/ 加载）
  if (url.startsWith("/pets/")) {
    return url;
  }
  // Gateway asset 路由（已安装 Pet）
  if (url.startsWith("/api/pet/asset/")) {
    return `${API_BASE}${url}`;
  }
  // HTTP URL 直接使用
  if (url.startsWith("http")) {
    return url;
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
