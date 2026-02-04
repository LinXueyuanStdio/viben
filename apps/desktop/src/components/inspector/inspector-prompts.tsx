import { useState } from "react";
import {
  MessageSquare,
  Play,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import type { McpPrompt } from "@/types";

interface InspectorPromptsProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface PromptMessage {
  role: string;
  content: {
    type: string;
    text?: string;
  };
}

interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

export function InspectorPrompts({ makeRequest, enabled = true }: InspectorPromptsProps) {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<McpPrompt | null>(null);
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({});
  const [promptResult, setPromptResult] = useState<PromptResult | null>(null);
  const [getting, setGetting] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const fetchPrompts = async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const response = await makeRequest<{ prompts: McpPrompt[] }>("prompts/list", {});
      setPrompts(response.prompts || []);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const clearPrompts = () => {
    setPrompts([]);
    setSelectedPrompt(null);
    setPromptResult(null);
  };

  const handlePromptGet = async () => {
    if (!selectedPrompt) return;

    setGetting(true);
    setPromptResult(null);

    try {
      const response = await makeRequest<PromptResult>("prompts/get", {
        name: selectedPrompt.name,
        arguments: promptArgs,
      });

      setPromptResult(response);
    } catch (error) {
      console.error("Error getting prompt:", error);
    } finally {
      setGetting(false);
    }
  };

  const handleArgChange = (argName: string, value: string) => {
    setPromptArgs((prev) => ({
      ...prev,
      [argName]: value,
    }));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user":
        return "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      case "assistant":
        return "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
      case "system":
        return "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800";
      default:
        return "text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700";
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <h4 className="text-sm font-medium">{t("inspector.promptsNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.promptsNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          <span className="text-sm font-medium">
            {t("inspector.prompts")} ({prompts.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearPrompts}
            disabled={loading || prompts.length === 0}
          >
            {t("common.clear")}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPrompts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? t("common.loading") : t("inspector.loadPrompts")}
          </Button>
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Prompt Selection and Arguments */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">{t("inspector.availablePrompts")}</h4>
            {loading && prompts.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {t("inspector.loadingPrompts")}
              </div>
            ) : prompts.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {t("inspector.clickLoadPrompts")}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.name}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPrompt?.name === prompt.name
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                        : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => {
                      setSelectedPrompt(prompt);
                      setPromptResult(null);
                      const initialArgs: Record<string, string> = {};
                      if (prompt.arguments) {
                        prompt.arguments.forEach((arg) => {
                          initialArgs[arg.name] = "";
                        });
                      }
                      setPromptArgs(initialArgs);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                        <div>
                          <div className="font-medium text-sm">{prompt.name}</div>
                          {prompt.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {prompt.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {prompt.arguments && prompt.arguments.length > 0 && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                            {prompt.arguments.length} {t("inspector.args")}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPrompt(
                              expandedPrompt === prompt.name ? null : prompt.name
                            );
                          }}
                        >
                          {expandedPrompt === prompt.name ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {expandedPrompt === prompt.name && prompt.arguments && (
                      <div className="mt-2 pt-2 border-t space-y-2">
                        <div className="text-xs font-medium">{t("inspector.arguments")}:</div>
                        <div className="space-y-1">
                          {prompt.arguments.map((arg) => (
                            <div
                              key={arg.name}
                              className="text-xs bg-white dark:bg-gray-800 p-2 rounded border"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{arg.name}</span>
                                {arg.required && (
                                  <span className="text-red-500 text-xs">
                                    {t("common.required")}
                                  </span>
                                )}
                              </div>
                              {arg.description && (
                                <div className="text-muted-foreground mt-1">
                                  {arg.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arguments Form */}
          {selectedPrompt && selectedPrompt.arguments && selectedPrompt.arguments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">{t("inspector.arguments")}</h4>
              <div className="space-y-3">
                {selectedPrompt.arguments.map((arg) => (
                  <div key={arg.name}>
                    <label className="text-xs font-medium">
                      {arg.name}
                      {arg.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {arg.description && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {arg.description}
                      </div>
                    )}
                    <Input
                      value={promptArgs[arg.name] || ""}
                      onChange={(e) => handleArgChange(arg.name, e.target.value)}
                      placeholder={t("inspector.enterArgValue", { argName: arg.name })}
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Get Prompt Button */}
          {selectedPrompt && (
            <Button onClick={handlePromptGet} disabled={getting} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {getting ? t("inspector.getting") : t("inspector.getPrompt")}
            </Button>
          )}
        </div>

        {/* Right: Prompt Result */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("inspector.promptResult")}</h4>
          {!selectedPrompt ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.selectPrompt")}
            </div>
          ) : getting ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.gettingPromptResult")}
            </div>
          ) : !promptResult ? (
            <div className="text-sm text-muted-foreground">
              {t("inspector.clickGetPrompt", { promptName: selectedPrompt.name })}
            </div>
          ) : (
            <div className="space-y-4">
              {promptResult.description && (
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {t("inspector.description")}
                  </div>
                  <div className="text-sm">{promptResult.description}</div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {t("inspector.messages")} ({promptResult.messages.length})
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {promptResult.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${getRoleColor(message.role)}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium uppercase">{message.role}</span>
                        <span className="text-xs opacity-75">({message.content.type})</span>
                      </div>
                      {message.content.type === "text" && message.content.text && (
                        <div className="text-sm whitespace-pre-wrap">{message.content.text}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-purple-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
              {t("inspector.aboutPrompts")}
            </h4>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              {t("inspector.aboutPromptsDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
