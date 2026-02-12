import { useState } from "react";
import { FolderTree, Folder, AlertTriangle, Plus, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface Root {
  uri: string;
  name?: string;
}

interface InspectorRootsProps {
  enabled?: boolean;
}

export function InspectorRoots({ enabled = true }: InspectorRootsProps) {
  const { t } = useTranslation();
  const [roots, setRoots] = useState<Root[]>([]);
  const [loading, setLoading] = useState(false);
  const [customRoots, setCustomRoots] = useState<Root[]>([]);
  const [newRootUri, setNewRootUri] = useState("");
  const [newRootName, setNewRootName] = useState("");

  const fetchRoots = async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      // Note: The MCP protocol doesn't have a standard roots/list method
      // Roots are typically managed through notifications and server capabilities
      // This is a placeholder for future implementation
      setRoots([]);
    } catch {
      // Roots listing not supported - this is expected behavior
      setRoots([]);
    } finally {
      setLoading(false);
    }
  };

  const addCustomRoot = () => {
    if (!newRootUri.trim()) {
      return;
    }

    const newRoot: Root = {
      uri: newRootUri.trim(),
      name: newRootName.trim() || undefined,
    };

    setCustomRoots((prev) => [...prev, newRoot]);
    setNewRootUri("");
    setNewRootName("");
  };

  const removeCustomRoot = (index: number) => {
    setCustomRoots((prev) => prev.filter((_, i) => i !== index));
  };

  const getRootDisplayName = (root: Root) => {
    return root.name || root.uri.split("/").pop() || root.uri;
  };

  const getRootIcon = (uri: string) => {
    if (uri.startsWith("file://")) {
      return Folder;
    }
    return FolderTree;
  };

  const getRootType = (uri: string) => {
    if (uri.startsWith("file://")) return "File System";
    if (uri.startsWith("http://") || uri.startsWith("https://")) return "HTTP";
    if (uri.startsWith("ftp://")) return "FTP";
    if (uri.startsWith("sftp://")) return "SFTP";
    return "Other";
  };

  const allRoots = [...roots, ...customRoots];

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <h4 className="text-sm font-medium">{t("inspector.rootsNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.rootsNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-orange-500" />
          <span className="text-sm font-medium">
            {t("inspector.roots")} ({allRoots.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoots} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("inspector.refreshRoots")}
          </Button>
        </div>
      </div>

      {/* Add Custom Root */}
      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-semibold mb-3">{t("inspector.addCustomRoot")}</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">{t("inspector.rootUri")}</label>
            <Input
              value={newRootUri}
              onChange={(e) => setNewRootUri(e.target.value)}
              placeholder={t("inspector.rootUriPlaceholder", "file:///path/to/directory or https://example.com")}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium">{t("inspector.rootName")}</label>
            <Input
              value={newRootName}
              onChange={(e) => setNewRootName(e.target.value)}
              placeholder={t("inspector.rootNamePlaceholder")}
              className="text-xs"
            />
          </div>
          <Button
            onClick={addCustomRoot}
            disabled={!newRootUri.trim()}
            size="sm"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("inspector.addRoot")}
          </Button>
        </div>
      </div>

      {/* Roots List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{t("inspector.availableRoots")}</h4>
        {loading ? (
          <div className="text-sm text-muted-foreground">{t("inspector.loadingRoots")}</div>
        ) : allRoots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FolderTree className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h4 className="text-sm font-medium">{t("inspector.noRootsConfigured")}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {t("inspector.noRootsConfiguredDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allRoots.map((root, index) => {
              const RootIcon = getRootIcon(root.uri);
              const isCustom = index >= roots.length;
              return (
                <div
                  key={`${root.uri}-${index}`}
                  className="border rounded-lg p-4 hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <RootIcon className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{getRootDisplayName(root)}</span>
                        {root.name && root.name !== root.uri && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {t("inspector.named")}
                          </span>
                        )}
                        {isCustom && (
                          <span className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                            {t("inspector.custom")}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {root.uri}
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{t("inspector.type")}: {getRootType(root.uri)}</span>
                        {root.uri.startsWith("file://") && (
                          <span>{t("inspector.path")}: {root.uri.replace("file://", "")}</span>
                        )}
                      </div>
                    </div>

                    {isCustom && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCustomRoot(index - roots.length)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-4">
        <div className="flex items-start gap-3">
          <FolderTree className="h-5 w-5 text-orange-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
              {t("inspector.aboutRoots")}
            </h4>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {t("inspector.aboutRootsDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
