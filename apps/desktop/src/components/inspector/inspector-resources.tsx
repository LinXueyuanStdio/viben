import { useState, useMemo } from "react";
import {
  FileText,
  Eye,
  RefreshCw,
  AlertTriangle,
  Search,
  Copy,
  Check,
  Trash2,
  FileCode,
  FileImage,
  File,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Filter resources by search query
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const query = searchQuery.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.uri.toLowerCase().includes(query) ||
        resource.name?.toLowerCase().includes(query) ||
        resource.description?.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

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

  const clearAll = () => {
    setResources([]);
    setSelectedResource(null);
    setResourceContent(null);
    setSearchQuery("");
  };

  const handleResourceRead = async (resource: McpResource) => {
    setSelectedResource(resource);
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

  const copyContent = async () => {
    if (!resourceContent?.text) return;
    await navigator.clipboard.writeText(resourceContent.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getResourceIcon = (resource: McpResource) => {
    const mimeType = resource.mimeType?.toLowerCase() || "";
    const uri = resource.uri.toLowerCase();

    if (mimeType.includes("image") || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(uri)) {
      return FileImage;
    }
    if (mimeType.includes("json") || mimeType.includes("javascript") || /\.(js|ts|json|xml|html|css)$/i.test(uri)) {
      return FileCode;
    }
    if (mimeType.includes("text")) {
      return FileText;
    }
    return File;
  };

  const getResourceDisplayName = (resource: McpResource) => {
    return resource.name || resource.uri.split("/").pop() || resource.uri;
  };

  const formatContent = (content: ResourceContent) => {
    if (content.text) return content.text;
    if (content.blob) return t("inspector.binaryContent", { length: content.blob.length });
    return t("inspector.noContentAvailable");
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.resourcesNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.resourcesNotSupportedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Resource List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border pr-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{t("inspector.resources")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{resources.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={resources.length === 0}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchResources} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("inspector.searchResources")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-auto space-y-1">
          {resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.clickLoadResources")}</p>
              <Button size="sm" className="mt-3" onClick={fetchResources} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {t("inspector.loadResources")}
              </Button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center p-4 text-xs text-muted-foreground">
              {t("inspector.noResourcesFound")}
            </div>
          ) : (
            filteredResources.map((resource) => {
              const Icon = getResourceIcon(resource);
              const isSelected = selectedResource?.uri === resource.uri;

              return (
                <div
                  key={resource.uri}
                  onClick={() => handleResourceRead(resource)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-green-500/10 border border-green-500/30"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{getResourceDisplayName(resource)}</div>
                      {resource.mimeType && (
                        <div className="text-[10px] text-muted-foreground truncate">{resource.mimeType}</div>
                      )}
                    </div>
                  </div>
                  {resource.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">{resource.description}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Resource Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedResource ? (
          <>
            {/* Resource Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate">{getResourceDisplayName(selectedResource)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-md">
                    {selectedResource.uri}
                  </code>
                  {selectedResource.mimeType && (
                    <Badge variant="outline" className="h-5 px-1.5 text-xs">
                      {selectedResource.mimeType}
                    </Badge>
                  )}
                </div>
              </div>
              {resourceContent?.text && (
                <Button variant="outline" size="sm" onClick={copyContent} className="ml-2">
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? t("common.copied") : t("common.copy")}
                </Button>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              {reading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">{t("inspector.readingContent")}</p>
                </div>
              ) : resourceContent ? (
                <div className="h-full rounded-lg border border-border bg-muted/30 p-4 overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {formatContent(resourceContent)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("inspector.contentNotLoaded")}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("inspector.selectResource")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("inspector.selectResourceDesc")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
