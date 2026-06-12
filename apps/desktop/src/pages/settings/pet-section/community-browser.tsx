// apps/desktop/src/pages/settings/pet-section/community-browser.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, Search, Loader2 } from "lucide-react";
import { fetchCommunityPets, installPet, fetchSources } from "./api";
import type { CommunityPetResponse, PetSourceResponse } from "./api";

interface CommunityBrowserProps {
  onInstalled: () => void;
}

export function CommunityBrowser({ onInstalled }: CommunityBrowserProps) {
  const { t } = useTranslation();
  const [pets, setPets] = useState<CommunityPetResponse[]>([]);
  const [sources, setSources] = useState<PetSourceResponse[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSources().then((data) => setSources(data.sources)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCommunityPets(selectedSource || undefined)
      .then((data) => setPets(data.pets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedSource]);

  const filteredPets = searchQuery
    ? pets.filter(
        (p) =>
          (p.id ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.display_name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pets;

  const handleInstall = async (pet: CommunityPetResponse) => {
    if (!pet.id || !pet.source) {
      setError(t("settings.pet.petDataIncomplete"));
      return;
    }
    setInstalling(pet.id);
    try {
      await installPet(pet.id, pet.source);
      onInstalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.pet.installFailed"));
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("common.search", "Search...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">{t("settings.pet.allSources", "All Sources")}</option>
          {sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {filteredPets.map((pet) => (
            <div
              key={`${pet.source}-${pet.id}`}
              className="rounded-lg border p-2 flex flex-col items-center gap-1"
            >
              {pet.thumbnail_url ? (
                <img
                  src={pet.thumbnail_url}
                  alt={pet.display_name ?? pet.id}
                  className="h-12 w-12 rounded object-contain bg-muted"
                  loading="lazy"
                />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-lg">
                  {(pet.display_name ?? pet.id ?? "?").charAt(0)}
                </div>
              )}
              <span className="text-xs truncate w-full text-center">{pet.display_name ?? pet.id}</span>
              <button
                className="mt-1 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                disabled={installing === pet.id}
                onClick={() => handleInstall(pet)}
              >
                {installing === pet.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {t("common.install", "Install")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
