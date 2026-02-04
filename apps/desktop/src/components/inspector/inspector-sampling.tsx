import { useState } from "react";
import { ActivitySquare, AlertTriangle, Brain, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

interface SamplingMessage {
  role: "user" | "assistant" | "system";
  content: {
    type: "text";
    text: string;
  };
}

interface SamplingResponse {
  role: "assistant";
  content: {
    type: "text";
    text: string;
  };
  model: string;
  stopReason?: "endTurn" | "stopSequence" | "maxTokens";
}

interface InspectorSamplingProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

export function InspectorSampling({ makeRequest, enabled = true }: InspectorSamplingProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<SamplingMessage[]>([
    {
      role: "user",
      content: { type: "text", text: "Hello! Can you help me?" },
    },
  ]);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(1.0);
  const [stopSequences, setStopSequences] = useState<string>("");
  const [response, setResponse] = useState<SamplingResponse | null>(null);
  const [sampling, setSampling] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [newMessageRole, setNewMessageRole] = useState<"user" | "system">("user");

  const handleAddMessage = () => {
    if (!newMessageText.trim()) return;

    const newMessage: SamplingMessage = {
      role: newMessageRole,
      content: { type: "text", text: newMessageText.trim() },
    };

    setMessages((prev) => [...prev, newMessage]);
    setNewMessageText("");
  };

  const handleRemoveMessage = (index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSample = async () => {
    if (messages.length === 0) {
      return;
    }

    setSampling(true);
    setResponse(null);

    try {
      // Try to use sampling/createMessage
      const samplingRequest = {
        messages,
        maxTokens,
        temperature,
        topP,
        ...(stopSequences.trim() && {
          stopSequences: stopSequences
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      };

      const result = await makeRequest<SamplingResponse>("sampling/createMessage", samplingRequest);
      setResponse(result);
    } catch {
      // Simulate response if sampling is not supported
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const simulatedResult: SamplingResponse = {
        role: "assistant",
        content: {
          type: "text",
          text: t("inspector.samplingSimulatedResponse"),
        },
        model: "simulated-model",
        stopReason: "endTurn",
      };

      setResponse(simulatedResult);
    } finally {
      setSampling(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100";
      case "assistant":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100";
      case "system":
        return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100";
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <h4 className="text-sm font-medium">{t("inspector.samplingNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.samplingNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivitySquare className="h-5 w-5 text-pink-500" />
          <span className="text-sm font-medium">{t("inspector.llmSampling")}</span>
        </div>
        <Button
          onClick={handleSample}
          disabled={sampling || messages.length === 0}
          className="flex items-center gap-2"
        >
          <Brain className={`h-4 w-4 ${sampling ? "animate-pulse" : ""}`} />
          {sampling ? t("inspector.sampling") : t("inspector.sample")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Messages and Configuration */}
        <div className="space-y-6">
          {/* Messages */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">{t("inspector.messages")}</h4>

            {/* Existing Messages */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getRoleColor(message.role)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium uppercase">{message.role}</span>
                    <button
                      onClick={() => handleRemoveMessage(index)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                  <div className="text-sm">{message.content.text}</div>
                </div>
              ))}
            </div>

            {/* Add New Message */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{t("inspector.addMessage")}:</span>
                <select
                  value={newMessageRole}
                  onChange={(e) => setNewMessageRole(e.target.value as "user" | "system")}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="user">User</option>
                  <option value="system">System</option>
                </select>
              </div>
              <Textarea
                placeholder={t("inspector.enterMessageContent")}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleAddMessage}
                disabled={!newMessageText.trim()}
                size="sm"
                className="w-full"
              >
                {t("inspector.addMessageBtn")}
              </Button>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">{t("inspector.samplingParameters")}</h4>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("inspector.maxTokens")}</label>
                <Input
                  type="number"
                  min="1"
                  max="4000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("inspector.temperature")}</label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("inspector.topP")}</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value) || 1.0)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("inspector.stopSequences")}</label>
                <Input
                  placeholder={t("inspector.stopSequencesPlaceholder")}
                  value={stopSequences}
                  onChange={(e) => setStopSequences(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Response */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">{t("inspector.response")}</h4>

          {response ? (
            <div className="space-y-4">
              {/* Response Message */}
              <div className={`p-4 rounded-lg border ${getRoleColor("assistant")}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase">
                    {t("inspector.assistantResponse")}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    {response.model}
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{response.content.text}</div>
              </div>

              {/* Response Metadata */}
              <div className="bg-muted/50 p-3 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {t("inspector.responseMetadata")}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>{t("inspector.model")}:</span>
                    <span className="font-mono">{response.model}</span>
                  </div>
                  {response.stopReason && (
                    <div className="flex justify-between">
                      <span>{t("inspector.stopReason")}:</span>
                      <span className="font-mono">{response.stopReason}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t("inspector.responseLength")}:</span>
                    <span className="font-mono">{response.content.text.length} chars</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed rounded-lg p-8 text-center">
              <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {sampling ? t("inspector.generatingResponse") : t("inspector.configureSampling")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800 p-4">
        <div className="flex items-start gap-3">
          <ActivitySquare className="h-5 w-5 text-pink-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-pink-900 dark:text-pink-100 mb-1">
              {t("inspector.aboutSampling")}
            </h4>
            <p className="text-xs text-pink-700 dark:text-pink-300">
              {t("inspector.aboutSamplingDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
