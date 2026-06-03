// apps/desktop/src/pages/settings/pet-section/pet-selector.tsx
import { Check, Trash2 } from "lucide-react";
import { PetPreview } from "./pet-preview";
import type { PetResponse } from "./api";

interface PetSelectorProps {
  pets: PetResponse[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function PetSelector({ pets, currentId, onSelect, onRemove }: PetSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
      {pets.map((pet) => (
        <div
          key={pet.id}
          className={`group relative cursor-pointer rounded-lg border-2 p-2 transition-colors ${
            currentId === pet.id
              ? "border-primary bg-primary/10"
              : "border-transparent hover:border-muted-foreground/30"
          }`}
          onClick={() => onSelect(pet.id)}
        >
          <div className="flex flex-col items-center gap-1">
            <PetPreview pet={pet} size={48} />
            <span className="text-xs truncate w-full text-center">{pet.metadata.display_name}</span>
          </div>

          {currentId === pet.id && (
            <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}

          {!pet.is_builtin && (
            <button
              className="absolute top-1 right-1 hidden rounded p-1 hover:bg-destructive/20 group-hover:block"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(pet.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
