import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CacheManager } from "@/components/offline/cache-manager";
import { useTranslation } from "react-i18next";

export function StorageSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.storage")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.storageDescription", { defaultValue: "Manage downloads and cache" })}
        </p>
      </div>

      {/* Download Path */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">{t("settings.downloadPath")}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            defaultValue="~/Downloads/browse-mcp"
            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <Button variant="outline" size="icon" className="rounded-xl">
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Offline Cache */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">{t("settings.offlineCache")}</h3>
        <CacheManager />
      </div>
    </div>
  );
}
