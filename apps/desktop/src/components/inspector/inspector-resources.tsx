import { useState } from "react";
import {
  FileText,
  Eye,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import type { McpResource } from "@/types";

interface InspectorResourcesProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export function InspectorResources({ makeRequest, enabled = true }: InspectorResourcesProps) {
  const { t } = useTranslation();
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState<McpResource | null>(null);
  const [resourceContent, setResourceContent] = useState<ResourceContent | null>(null);
  const [reading, setReading] = useState(false);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const fetchResources = async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const response = await makeRequest<{ resources: McpResource[] }>("resources/list", {});
      setResources(response.resources || []);
    } catch (error) {
      console.error("Error fetching resources:", error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const clearResources = () => {
    setResources([]);
    setSelectedResource(null);
    setResourceContent(null);
  };

  const handleResourceRead = async (resource: McpResource) => {
    setReading(true);
    setResourceContent(null);

    try {
      const response = await makeRequest<{ contents: ResourceContent[] }>("resources/read", {
        uri: resource.uri,
      });

      if (response?.contents && response.contents.length > 0) {
        setResourceContent(response.contents[0]);
      }
    } catch (error) {
      console.error("Error reading resource:", error);
    } finally {
      setReading(false);
    }
  };

  const formatResourceContent = (content: ResourceContent) => {
    if (content.text) {
      return content.text;
    } else if (content.blob) {
      return t("inspector.binaryContent", { length: content.blob.length });
    }
    return t("inspector.noContentAvailable");
  };

  const getResourceDisplayName = (resource: McpResource) => {
    return resource.name || resource.uri.split("/").pop() || resource.uri;
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <h4 className="text-sm font-medium">{t("inspector.resourcesNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.resourcesNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium">
            {t("inspector.resources")} ({resources.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearResources}
            disabled={loading || resources.length === 0}
          >
            {t("common.clear")}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchResources} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? t("common.loading") : t("inspector.loadResources")}
          </Button>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Resource List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("inspector.availableResources")}</h4>
          {loading && resources.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.loadingResources")}
            </div>
          ) : resources.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.clickLoadResources")}
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {resources.map((resource) => (
                <div
                  key={resource.uri}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedResource?.uri === resource.uri
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : "hover:border-muted-foreground/30"
                  }`}
                  onClick={() => {
                    setSelectedResource(resource);
                    setExpandedResource(resource.uri);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="text-sm font-medium">
                          {getResourceDisplayName(resource)}
                        </div>
                        {resource.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {resource.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedResource(
                          expandedResource === resource.uri ? null : resource.uri
                        );
                      }}
                    >
                      {expandedResource === resource.uri ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {expandedResource === resource.uri && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="text-xs text-muted-foreground">
                        <div>URI: {resource.uri}</div>
                        {resource.mimeType && <div>MIME Type: {resource.mimeType}</div>}
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResourceRead(resource);
                        }}
                        disabled={reading}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {t("inspector.read")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Resource Content */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("inspector.resourceContent")}</h4>
          {!selectedResource ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.selectResource")}
            </div>
          ) : reading ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.readingContent")}
            </div>
          ) : !resourceContent ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.clickRead", { resourceName: getResourceDisplayName(selectedResource) })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                <div>URI: {resourceContent.uri}</div>
                {resourceContent.mimeType && <div>MIME Type: {resourceContent.mimeType}</div>}
              </div>
              <div className="border rounded-lg p-3 bg-muted/50 max-h-96 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {formatResourceContent(resourceContent)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
              {t("inspector.aboutResources")}
            </h4>
            <p className="text-xs text-green-700 dark:text-green-300">
              {t("inspector.aboutResourcesDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
