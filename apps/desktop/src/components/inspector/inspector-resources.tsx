import { useState, useMemo, useCallback, useEffect } from "react";
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
  LayoutTemplate,
  Bell,
  BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useCompletion, createCompletionHandler } from "@/hooks/use-completion";
import { CompletionInput } from "./completion-input";
import type { McpResource, McpServerCapabilities } from "@/types";
import { UriTemplate } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

interface InspectorResourcesProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
  /** Whether the server supports completions */
  completionsSupported?: boolean;
  /** Server capabilities to check for subscription support */
  serverCapabilities?: McpServerCapabilities | null;
  /** Callback when a subscribed resource is updated (notification received) */
  onResourceUpdated?: (uri: string) => void;
  /** URI of a resource that was just updated via notification - parent should set this when receiving notifications/resources/updated */
  updatedResourceUri?: string | null;
}

interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

interface ResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

// =============================================================================
// URI Template Helpers
// =============================================================================

/**
 * Extract variable names from a URI template using the SDK UriTemplate class
 * Handles RFC 6570 Level 4 templates including:
 * - Simple: {var}
 * - Reserved: {+var}
 * - Fragment: {#var}
 * - Query: {?var1,var2}
 * - Path: {/var}
 */
function extractTemplateVariables(template: string): string[] {
  try {
    const uriTemplate = new UriTemplate(template);
    return uriTemplate.variableNames || [];
  } catch (error) {
    console.error("Failed to parse URI template:", error);
    // Fallback to simple regex extraction
    const regex = /\{[?+#./;]?([^}]+)\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      // Split by comma for query params like {?name,limit}
      const varPart = match[1];
      const names = varPart.split(",").map((v) => v.trim());
      variables.push(...names);
    }
    return variables;
  }
}

/**
 * Expand a URI template with values using the SDK UriTemplate class
 * Supports full RFC 6570 Level 4 template syntax
 */
function expandTemplate(template: string, values: Record<string, string>): string {
  try {
    const uriTemplate = new UriTemplate(template);
    return uriTemplate.expand(values);
  } catch (error) {
    console.error("Failed to expand URI template:", error);
    // Fallback to simple replacement
    return template.replace(/\{[?+#./;]?([^}]+)\}/g, (_, varPart) => {
      // Handle comma-separated vars (query params)
      const names = varPart.split(",").map((v: string) => v.trim());
      if (names.length > 1) {
        // Query parameter expansion
        const params = names
          .filter((name: string) => values[name])
          .map((name: string) => `${name}=${encodeURIComponent(values[name])}`)
          .join("&");
        return params ? `?${params}` : "";
      }
      return values[names[0]] || "";
    });
  }
}

// =============================================================================
// Component
// =============================================================================

export function InspectorResources({
  makeRequest,
  enabled = true,
  completionsSupported = true,
  serverCapabilities,
  onResourceUpdated,
  updatedResourceUri,
}: InspectorResourcesProps) {
  const { t } = useTranslation();

  // Check if server supports resource subscriptions
  const supportsSubscribe = useMemo(() => {
    const resources = serverCapabilities?.resources as Record<string, unknown> | undefined;
    return resources?.subscribe === true;
  }, [serverCapabilities]);

  // Resources state
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [selectedResource, setSelectedResource] = useState<McpResource | null>(null);
  const [resourceContent, setResourceContent] = useState<ResourceContent | null>(null);
  const [reading, setReading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Resource templates state
  const [templates, setTemplates] = useState<ResourceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ResourceTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("resources");

  // Subscription state
  const [subscribedResources, setSubscribedResources] = useState<Set<string>>(new Set());
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const [updatedResources, setUpdatedResources] = useState<Set<string>>(new Set());

  // Completion hook
  const handleCompletion = useCallback(
    createCompletionHandler(makeRequest),
    [makeRequest]
  );

  const {
    completions,
    loading: completionLoading,
    clearCompletions,
    triggerCompletion,
  } = useCompletion({
    handleCompletion,
    completionsSupported,
  });

  // Clear completions when template changes
  useEffect(() => {
    clearCompletions();
  }, [selectedTemplate, clearCompletions]);

  // Handle resource update notifications from parent
  useEffect(() => {
    if (updatedResourceUri && subscribedResources.has(updatedResourceUri)) {
      setUpdatedResources((prev) => new Set(prev).add(updatedResourceUri));
      onResourceUpdated?.(updatedResourceUri);
    }
  }, [updatedResourceUri, subscribedResources, onResourceUpdated]);

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

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (template) =>
        template.uriTemplate.toLowerCase().includes(query) ||
        template.name?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Fetch resources
  const fetchResources = async (cursor?: string) => {
    if (!enabled) return;

    const isLoadMore = !!cursor;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, unknown> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await makeRequest<{ resources: McpResource[]; nextCursor?: string }>(
        "resources/list",
        params
      );
      const newResources = response.resources || [];

      if (isLoadMore) {
        setResources((prev) => [...prev, ...newResources]);
      } else {
        setResources(newResources);
      }

      setNextCursor(response.nextCursor);
    } catch (error) {
      console.error("Error fetching resources:", error);
      if (!isLoadMore) {
        setResources([]);
      }
      setNextCursor(undefined);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Fetch resource templates
  const fetchTemplates = async (cursor?: string) => {
    if (!enabled) return;

    const isLoadMore = !!cursor;
    if (isLoadMore) {
      // Handle load more for templates
    } else {
      setTemplatesLoading(true);
    }

    try {
      const params: Record<string, unknown> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await makeRequest<{
        resourceTemplates: ResourceTemplate[];
        nextCursor?: string;
      }>("resources/templates/list", params);

      const newTemplates = response.resourceTemplates || [];

      if (isLoadMore) {
        setTemplates((prev) => [...prev, ...newTemplates]);
      } else {
        setTemplates(newTemplates);
      }
    } catch (error) {
      console.error("Error fetching resource templates:", error);
      if (!isLoadMore) {
        setTemplates([]);
      }
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadMoreResources = () => {
    if (nextCursor) {
      fetchResources(nextCursor);
    }
  };

  const clearAll = () => {
    setResources([]);
    setSelectedResource(null);
    setResourceContent(null);
    setSearchQuery("");
    setNextCursor(undefined);
    setTemplates([]);
    setSelectedTemplate(null);
    setTemplateValues({});
    setSubscribedResources(new Set());
    setSubscribing(new Set());
    setUpdatedResources(new Set());
    clearCompletions();
  };

  // Subscribe to a resource
  const handleSubscribe = async (uri: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!supportsSubscribe || subscribedResources.has(uri)) return;

    setSubscribing((prev) => new Set(prev).add(uri));
    try {
      await makeRequest("resources/subscribe", { uri });
      setSubscribedResources((prev) => new Set(prev).add(uri));
      // Clear any pending update indicator when subscribing
      setUpdatedResources((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    } catch (error) {
      console.error("Error subscribing to resource:", error);
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    }
  };

  // Unsubscribe from a resource
  const handleUnsubscribe = async (uri: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!supportsSubscribe || !subscribedResources.has(uri)) return;

    setSubscribing((prev) => new Set(prev).add(uri));
    try {
      await makeRequest("resources/unsubscribe", { uri });
      setSubscribedResources((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
      // Clear update indicator when unsubscribing
      setUpdatedResources((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    } catch (error) {
      console.error("Error unsubscribing from resource:", error);
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    }
  };

  // Clear update indicator when reading a resource
  const clearUpdateIndicator = (uri: string) => {
    setUpdatedResources((prev) => {
      const next = new Set(prev);
      next.delete(uri);
      return next;
    });
  };

  // Read a resource
  const handleResourceRead = async (resource: McpResource) => {
    setSelectedResource(resource);
    setSelectedTemplate(null);
    setReading(true);
    setResourceContent(null);
    // Clear update indicator when reading the resource
    clearUpdateIndicator(resource.uri);

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

  // Select a template
  const handleTemplateSelect = (template: ResourceTemplate) => {
    setSelectedTemplate(template);
    setSelectedResource(null);
    setResourceContent(null);
    setTemplateValues({});
    clearCompletions();
  };

  // Handle template value change with completions
  const handleTemplateValueChange = (key: string, value: string) => {
    setTemplateValues((prev) => ({ ...prev, [key]: value }));

    // Trigger completion for this argument
    if (selectedTemplate?.uriTemplate) {
      triggerCompletion(
        {
          type: "ref/resource",
          uri: selectedTemplate.uriTemplate,
        },
        key,
        value,
        templateValues
      );
    }
  };

  // Handle template value focus (trigger initial completions)
  const handleTemplateValueFocus = (key: string) => {
    const currentValue = templateValues[key] || "";
    if (selectedTemplate?.uriTemplate) {
      triggerCompletion(
        {
          type: "ref/resource",
          uri: selectedTemplate.uriTemplate,
        },
        key,
        currentValue,
        templateValues
      );
    }
  };

  // Read resource from template
  const handleReadTemplateResource = async () => {
    if (!selectedTemplate) return;

    const uri = expandTemplate(selectedTemplate.uriTemplate, templateValues);
    const virtualResource: McpResource = {
      uri,
      name: uri,
      mimeType: selectedTemplate.mimeType,
    };

    setSelectedResource(virtualResource);
    setReading(true);
    setResourceContent(null);

    try {
      const response = await makeRequest<{ contents: ResourceContent[] }>("resources/read", {
        uri,
      });

      if (response?.contents && response.contents.length > 0) {
        setResourceContent(response.contents[0]);
      }
    } catch (error) {
      console.error("Error reading template resource:", error);
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
    if (
      mimeType.includes("json") ||
      mimeType.includes("javascript") ||
      /\.(js|ts|json|xml|html|css)$/i.test(uri)
    ) {
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
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.resourcesNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Resources & Templates */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-border pr-4">
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

        {/* Tabs for Resources and Templates */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="resources"
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="resources" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t("inspector.resources")}
              {resources.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {resources.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
              {t("inspector.templates", "Templates")}
              {templates.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Resources Tab */}
          <TabsContent value="resources" className="flex-1 flex flex-col mt-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={clearAll}
                  disabled={resources.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => fetchResources()}
                  disabled={loading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {/* Subscription status */}
              {supportsSubscribe && subscribedResources.size > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bell className="h-3 w-3 text-blue-500" />
                  <span>
                    {subscribedResources.size} {t("inspector.subscriptions", "subscriptions")}
                  </span>
                  {updatedResources.size > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20">
                      {updatedResources.size} {t("inspector.new", "new")}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Resource List */}
            <div className="flex-1 overflow-auto space-y-1">
              {resources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("inspector.clickLoadResources")}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => fetchResources()}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    {t("inspector.loadResources")}
                  </Button>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="text-center p-4 text-xs text-muted-foreground">
                  {t("inspector.noResourcesFound")}
                </div>
              ) : (
                <>
                  {filteredResources.map((resource) => {
                    const Icon = getResourceIcon(resource);
                    const isSelected =
                      selectedResource?.uri === resource.uri && !selectedTemplate;
                    const isSubscribed = subscribedResources.has(resource.uri);
                    const isSubscribing = subscribing.has(resource.uri);
                    const hasUpdate = updatedResources.has(resource.uri);

                    return (
                      <div
                        key={resource.uri}
                        onClick={() => handleResourceRead(resource)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-green-500/10 border border-green-500/30"
                            : isSubscribed
                              ? "bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10"
                              : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isSubscribed ? "text-blue-500" : "text-green-500"}`} />
                            {hasUpdate && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">
                                {getResourceDisplayName(resource)}
                              </span>
                              {isSubscribed && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  {t("inspector.subscribed", "Subscribed")}
                                </Badge>
                              )}
                              {hasUpdate && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 animate-pulse">
                                  {t("inspector.updated", "Updated")}
                                </Badge>
                              )}
                            </div>
                            {resource.mimeType && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                {resource.mimeType}
                              </div>
                            )}
                          </div>
                          {/* Subscribe/Unsubscribe Button */}
                          {supportsSubscribe && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 w-6 p-0 flex-shrink-0 ${isSubscribed ? "text-blue-500 hover:text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
                                    onClick={(e) => isSubscribed ? handleUnsubscribe(resource.uri, e) : handleSubscribe(resource.uri, e)}
                                    disabled={isSubscribing}
                                  >
                                    {isSubscribing ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : isSubscribed ? (
                                      <BellOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Bell className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p className="text-xs">
                                    {isSubscribed
                                      ? t("inspector.unsubscribe", "Unsubscribe from updates")
                                      : t("inspector.subscribe", "Subscribe to updates")}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {resource.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {nextCursor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={loadMoreResources}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : null}
                      {t("inspector.loadMore", "Load More")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="flex-1 flex flex-col mt-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setTemplates([]);
                    setSelectedTemplate(null);
                    setTemplateValues({});
                  }}
                  disabled={templates.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => fetchTemplates()}
                  disabled={templatesLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-auto space-y-1">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <LayoutTemplate className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("inspector.clickLoadTemplates", "Click to load templates")}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => fetchTemplates()}
                    disabled={templatesLoading}
                  >
                    {templatesLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    {t("inspector.loadTemplates", "Load Templates")}
                  </Button>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center p-4 text-xs text-muted-foreground">
                  {t("inspector.noTemplatesFound", "No templates found")}
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected =
                    selectedTemplate?.uriTemplate === template.uriTemplate;

                  return (
                    <div
                      key={template.uriTemplate}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-500/10 border border-blue-500/30"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {template.name || template.uriTemplate}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate font-mono">
                            {template.uriTemplate}
                          </div>
                        </div>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">
                          {template.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel - Resource Content or Template Form */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTemplate ? (
          // Template Form
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">
                {selectedTemplate.name || t("inspector.resourceTemplate", "Resource Template")}
              </h3>
              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 block">
                {selectedTemplate.uriTemplate}
              </code>
            </div>

            {selectedTemplate.description && (
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
            )}

            {/* Template Variables Form */}
            <div className="space-y-3">
              {extractTemplateVariables(selectedTemplate.uriTemplate).map((variable) => (
                <div key={variable}>
                  <Label htmlFor={variable} className="text-xs">
                    {variable}
                  </Label>
                  <CompletionInput
                    id={variable}
                    value={templateValues[variable] || ""}
                    onChange={(value) => handleTemplateValueChange(variable, value)}
                    onFocus={() => handleTemplateValueFocus(variable)}
                    completions={completions[variable] || []}
                    loading={completionLoading[variable]}
                    placeholder={t("inspector.enterValue", { name: variable })}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleReadTemplateResource}
              disabled={
                reading ||
                extractTemplateVariables(selectedTemplate.uriTemplate).some(
                  (v) => !templateValues[v]
                )
              }
              className="w-full"
            >
              {reading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("inspector.readResource", "Read Resource")}
            </Button>

            {/* Show content if loaded */}
            {resourceContent && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t("inspector.content", "Content")}</h4>
                  {resourceContent.text && (
                    <Button variant="outline" size="sm" onClick={copyContent}>
                      {copied ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      {copied ? t("common.copied") : t("common.copy")}
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-auto max-h-96">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {formatContent(resourceContent)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : selectedResource ? (
          // Resource Content
          <>
            {/* Resource Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate">
                  {getResourceDisplayName(selectedResource)}
                </h3>
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
                  {copied ? (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1" />
                  )}
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
          // No selection
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("inspector.selectResource")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("inspector.selectResourceDesc")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
