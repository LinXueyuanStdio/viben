/**
 * Channel Settings Page
 *
 * Configure communication channels for the AI gateway:
 * - Telegram
 * - Discord
 * - Feishu (飞书/Lark)
 * - WhatsApp
 *
 * Supports multiple instances of each channel type.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChannelInstances, useAgents } from "@/hooks";
import { useExecutorSessions } from "@/hooks/use-executor-sessions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway";
import type {
  ChannelType,
  GatewayChannel,
  ChannelConfig,
  AgentBinding,
  BindingType,
} from "@/types/channel";
import { getChannelTypeName } from "@/types/channel";

// Channel Icons (using simple SVG)
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 00-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 00-5.487 0 12.36 12.36 0 00-.617-1.23A.077.077 0 008.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 00-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 00.031.055 20.03 20.03 0 005.993 2.98.078.078 0 00.084-.026 13.83 13.83 0 001.226-1.963.074.074 0 00-.041-.104 13.201 13.201 0 01-1.872-.878.075.075 0 01-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 01.078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 01.079.009c.12.098.245.195.372.288a.075.075 0 01-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 00-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 00.084.028 19.963 19.963 0 006.002-2.981.076.076 0 00.032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 00-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
    </svg>
  );
}

function FeishuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  telegram: <TelegramIcon className="h-5 w-5" />,
  discord: <DiscordIcon className="h-5 w-5" />,
  feishu: <FeishuIcon className="h-5 w-5" />,
  whatsapp: <WhatsAppIcon className="h-5 w-5" />,
  slack: <DiscordIcon className="h-5 w-5" />, // Placeholder
  webhook: <RefreshCw className="h-5 w-5" />, // Placeholder
};

const CHANNEL_TYPES: ChannelType[] = ["telegram", "discord", "feishu", "whatsapp"];

// Password input with toggle visibility
interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  description?: string;
}

function SecretInput({ value, onChange, placeholder, label, description }: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground/70">{description}</p>
      )}
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10"
          onClick={() => setVisible(!visible)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Gateway API Functions (via backend)
// ============================================================================

/**
 * Build channel config request body for gateway API
 */
function buildChannelConfig(channel: GatewayChannel): ChannelConfig {
  return channel.config;
}

/**
 * Format error message for display
 */
function formatChannelError(
  error: string | undefined,
  channelType: ChannelType,
  t: TFunction
): string {
  if (!error) return t("channels.errors.unknown", "Unknown error");

  // Common error patterns with user-friendly messages
  const errorLower = error.toLowerCase();

  // Network errors
  if (errorLower.includes("fetch") || errorLower.includes("network") || errorLower.includes("econnrefused")) {
    return t("channels.errors.networkError", "Network error: Unable to connect. Please check your internet connection.");
  }

  // Gateway not running
  if (errorLower.includes("failed to fetch") || errorLower.includes("connection refused")) {
    return t("channels.errors.gatewayNotRunning", "Gateway not running. Please start the gateway service first.");
  }

  // Timeout
  if (errorLower.includes("timeout")) {
    return t("channels.errors.requestTimeout", "Request timed out. The service may be slow or unreachable.");
  }

  // Channel-specific error formatting
  switch (channelType) {
    case "telegram":
      if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
        return t("channels.errors.telegram.invalidToken", "Invalid Bot Token. Please check your token from @BotFather.");
      }
      if (errorLower.includes("chat not found") || errorLower.includes("400")) {
        return t("channels.errors.telegram.chatNotFound", "Chat not found. Make sure you've sent /start to the bot first.");
      }
      if (errorLower.includes("bot was blocked")) {
        return t("channels.errors.telegram.botBlocked", "Bot was blocked by the user. Please unblock the bot in Telegram.");
      }
      break;
    case "discord":
      if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
        return t("channels.errors.discord.invalidToken", "Invalid Bot Token. Please check your token from Discord Developer Portal.");
      }
      if (errorLower.includes("unknown channel") || errorLower.includes("404")) {
        return t("channels.errors.discord.channelNotFound", "Channel not found. Please verify the Channel ID.");
      }
      if (errorLower.includes("missing access") || errorLower.includes("403")) {
        return t("channels.errors.discord.missingAccess", "Bot lacks permission. Invite the bot to the channel first.");
      }
      break;
    case "feishu":
      if (errorLower.includes("invalid app_id") || errorLower.includes("10003")) {
        return t("channels.errors.feishu.invalidAppId", "Invalid App ID. Please check your credentials from Feishu Open Platform.");
      }
      if (errorLower.includes("app_secret") || errorLower.includes("10014")) {
        return t("channels.errors.feishu.invalidAppSecret", "Invalid App Secret. Please verify your credentials.");
      }
      if (errorLower.includes("user_not_found") || errorLower.includes("230001")) {
        return t("channels.errors.feishu.userNotFound", "User not found. Please check the Open ID or Chat ID.");
      }
      break;
    case "whatsapp":
      if (errorLower.includes("websocket") || errorLower.includes("ws://")) {
        return t("channels.errors.whatsapp.bridgeConnectionFailed", "Cannot connect to WhatsApp Bridge. Is the bridge server running?");
      }
      break;
  }

  // Return original error if no specific formatting
  return error;
}

/**
 * Test channel connection via gateway API (no Chat ID required)
 */
async function testChannelConnection(
  channel: GatewayChannel,
  t: TFunction
): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const gatewayUrl = getGatewayUrl();
    const response = await fetch(`${gatewayUrl}/api/channels/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_type: channel.channel_type,
        config: buildChannelConfig(channel),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Gateway returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      details: data.details,
      error: data.error ? formatChannelError(data.error, channel.channel_type, t) : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: formatChannelError(errorMsg, channel.channel_type, t),
    };
  }
}

/**
 * Send a test message via gateway API (requires Chat ID)
 */
async function sendTestMessage(
  channel: GatewayChannel,
  chatId: string | undefined,
  t: TFunction
): Promise<{ success: boolean; error?: string }> {
  if (!chatId && channel.channel_type !== "whatsapp") {
    return { success: false, error: "Chat ID is required to send test message" };
  }

  try {
    const gatewayUrl = getGatewayUrl();
    const response = await fetch(`${gatewayUrl}/api/channels/send-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_type: channel.channel_type,
        config: buildChannelConfig(channel),
        chat_id: chatId || "",
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Gateway returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      error: data.error ? formatChannelError(data.error, channel.channel_type, t) : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: formatChannelError(errorMsg, channel.channel_type, t),
    };
  }
}

// Instance card component
interface InstanceCardProps {
  channel: GatewayChannel;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTestConnection: () => void;
  onSendTestMessage: () => void;
  isTestingConnection?: boolean;
  isSendingTestMessage?: boolean;
}

function InstanceCard({
  channel,
  onToggle,
  onEdit,
  onDelete,
  onTestConnection,
  onSendTestMessage,
  isTestingConnection,
  isSendingTestMessage,
}: InstanceCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center",
            channel.enabled
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-muted"
          )}
        >
          <div
            className={cn(
              "h-4 w-4",
              channel.enabled
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            )}
          >
            {CHANNEL_ICONS[channel.channel_type]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-medium">{channel.name}</p>
            <p className="text-xs text-muted-foreground">
              {getChannelTypeName(channel.channel_type as ChannelType)}
            </p>
          </div>
          {channel.is_default && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {t("channels.default", "默认")}
            </span>
          )}
          {channel.agent_binding && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1">
              {channel.agent_binding.binding_type === "agent" ? "🤖" : "⚡"}
              {channel.agent_binding.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {channel.enabled ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch checked={channel.enabled} onCheckedChange={onToggle} />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
          onClick={onTestConnection}
          disabled={isTestingConnection}
          title={t("channels.testConnection", "Test Connection")}
        >
          {isTestingConnection ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:text-primary"
          onClick={onSendTestMessage}
          disabled={isSendingTestMessage}
          title={t("channels.sendTestMessage", "Send Test Message")}
        >
          {isSendingTestMessage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Form state for editing channels
interface ChannelFormState {
  name: string;
  channel_type: ChannelType;
  // Telegram
  token?: string;
  chat_id?: string;
  proxy?: string;
  // Feishu
  app_id?: string;
  app_secret?: string;
  // Agent/Executor binding
  agent_binding?: AgentBinding | null;
}

// Telegram config form
function TelegramForm({
  formState,
  onChange,
}: {
  formState: ChannelFormState;
  onChange: (update: Partial<ChannelFormState>) => void;
}) {
  const { t } = useTranslation();
  const token = formState.token ?? "";
  const chat_id = formState.chat_id ?? "";
  const proxy = formState.proxy ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.telegram.instancePlaceholder", "My Telegram Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.telegram.token", "Bot Token")}
        description={t("channels.telegram.tokenDescription", "从 @BotFather 获取")}
        value={token}
        onChange={(token) => onChange({ token })}
        placeholder={t("channels.telegram.tokenPlaceholder", "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ")}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.telegram.chatId", "Chat ID")}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <p className="text-xs text-muted-foreground/70">
          {t("channels.telegram.chatIdDescription", "消息发送的目标聊天 ID，可从 @userinfobot 获取")}
        </p>
        <Input
          value={chat_id}
          onChange={(e) => onChange({ chat_id: e.target.value })}
          placeholder={t("channels.telegram.chatIdExamplePlaceholder", "123456789")}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.telegram.proxy", "代理 (可选)")}
        </Label>
        <Input
          value={proxy}
          onChange={(e) => onChange({ proxy: e.target.value || undefined })}
          placeholder={t("channels.telegram.proxyPlaceholder", "http://127.0.0.1:7890")}
        />
      </div>
    </div>
  );
}

// Discord config form
function DiscordForm({
  formState,
  onChange,
}: {
  formState: ChannelFormState;
  onChange: (update: Partial<ChannelFormState>) => void;
}) {
  const { t } = useTranslation();
  const token = formState.token ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.discord.instancePlaceholder", "My Discord Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.discord.token", "Bot Token")}
        description={t("channels.discord.tokenDescription", "从 Discord Developer Portal 获取")}
        value={token}
        onChange={(token) => onChange({ token })}
        placeholder={t("channels.discord.tokenPlaceholder", "MTIzNDU2Nzg5...")}
      />
    </div>
  );
}

// Feishu config form
function FeishuForm({
  formState,
  onChange,
}: {
  formState: ChannelFormState;
  onChange: (update: Partial<ChannelFormState>) => void;
}) {
  const { t } = useTranslation();
  const app_id = formState.app_id ?? "";
  const app_secret = formState.app_secret ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.feishu.instancePlaceholder", "My Feishu Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.feishu.appId", "App ID")}
        description={t("channels.feishu.appIdDescription", "从飞书开放平台获取")}
        value={app_id}
        onChange={(app_id) => onChange({ app_id })}
        placeholder={t("channels.feishu.appIdPlaceholder", "cli_xxxxx")}
      />
      <SecretInput
        label={t("channels.feishu.appSecret", "App Secret")}
        value={app_secret}
        onChange={(app_secret) => onChange({ app_secret })}
        placeholder={t("channels.feishu.appSecretPlaceholder", "xxxxxxxx")}
      />
    </div>
  );
}

// WhatsApp config form
function WhatsAppForm({
  formState,
  onChange,
}: {
  formState: ChannelFormState;
  onChange: (update: Partial<ChannelFormState>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.whatsapp.instancePlaceholder", "My WhatsApp Bridge")}
        />
      </div>
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>{t("channels.whatsapp.note", "WhatsApp 需要配置 Bridge 服务器。")}</p>
      </div>
    </div>
  );
}

// Agent/Executor binding selector
function AgentBindingSelector({
  value,
  onChange,
  agents,
  executorSessions,
}: {
  value: AgentBinding | null | undefined;
  onChange: (binding: AgentBinding | null) => void;
  agents: { id: string; name: string }[];
  executorSessions: { id: string; name?: string; workspace_path: string }[];
}) {
  const { t } = useTranslation();

  // Build options list
  const options: { type: BindingType; id: string; name: string; workspace_path?: string }[] = [
    // Add agents
    ...agents.map((a) => ({ type: "agent" as BindingType, id: a.id, name: a.name })),
    // Add executors
    ...executorSessions.map((e) => ({
      type: "executor" as BindingType,
      id: e.id,
      name: e.name || `Claude Code (${e.workspace_path.split("/").pop()})`,
      workspace_path: e.workspace_path,
    })),
  ];

  const selectedValue = value ? `${value.binding_type}:${value.id}` : "none";

  const handleChange = (v: string) => {
    if (v === "none") {
      onChange(null);
      return;
    }
    const [type, id] = v.split(":");
    const option = options.find((o) => o.type === type && o.id === id);
    if (option) {
      onChange({
        binding_type: option.type,
        id: option.id,
        name: option.name,
        workspace_path: option.workspace_path,
      });
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("channels.agentBinding", "绑定智能体/执行器")}
      </Label>
      <p className="text-xs text-muted-foreground/70">
        {t("channels.agentBindingDescription", "接收到消息时自动路由给指定的智能体或执行器")}
      </p>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("channels.noBinding", "不绑定")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("channels.noBinding", "不绑定")}</SelectItem>
          {agents.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                {t("channels.agents", "智能体")}
              </div>
              {agents.map((agent) => (
                <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>
                  🤖 {agent.name}
                </SelectItem>
              ))}
            </>
          )}
          {executorSessions.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                {t("channels.executors", "执行器 (Claude Code)")}
              </div>
              {executorSessions.map((exec) => (
                <SelectItem key={`executor:${exec.id}`} value={`executor:${exec.id}`}>
                  ⚡ {exec.name || exec.workspace_path.split("/").pop()}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// Validation helper - check if all required fields are filled
function isFormValid(formState: ChannelFormState): boolean {
  if (!formState.name?.trim()) return false;

  switch (formState.channel_type) {
    case "telegram":
      return !!(formState.token?.trim() && formState.chat_id?.trim());
    case "discord":
      return !!formState.token?.trim();
    case "feishu":
      return !!(formState.app_id?.trim() && formState.app_secret?.trim());
    case "whatsapp":
      return true; // WhatsApp doesn't require config for now
    default:
      return false;
  }
}

// Get default form state for a channel type
function getDefaultFormState(type: ChannelType, name: string = ""): ChannelFormState {
  return {
    name,
    channel_type: type,
    token: "",
    chat_id: "",
    proxy: "",
    app_id: "",
    app_secret: "",
    agent_binding: null,
  };
}

// Build ChannelConfig from form state
function buildConfigFromForm(formState: ChannelFormState): ChannelConfig {
  switch (formState.channel_type) {
    case "telegram":
      return {
        type: "telegram",
        token: formState.token || undefined,
        chat_id: formState.chat_id || "",
        proxy: formState.proxy || undefined,
      };
    case "discord":
      return {
        type: "discord",
        token: formState.token || undefined,
      };
    case "feishu":
      return {
        type: "feishu",
        app_id: formState.app_id || undefined,
        app_secret: formState.app_secret || undefined,
      };
    case "whatsapp":
      return {
        type: "whatsapp",
      };
    default:
      return { type: "none" };
  }
}

// Initialize form state from existing channel
function initFormStateFromChannel(channel: GatewayChannel): ChannelFormState {
  const base: ChannelFormState = {
    name: channel.name,
    channel_type: channel.channel_type as ChannelType,
    agent_binding: channel.agent_binding || null,
  };

  // Use channel_type from the top-level field, not config.type
  // because the API returns config without the type field
  const config = channel.config as Record<string, unknown>;

  switch (channel.channel_type) {
    case "telegram":
      return {
        ...base,
        token: (config.token as string) || "",
        chat_id: (config.chat_id as string) || "",
        proxy: (config.proxy as string) || "",
      };
    case "discord":
      return {
        ...base,
        token: (config.token as string) || "",
      };
    case "feishu":
      return {
        ...base,
        app_id: (config.app_id as string) || "",
        app_secret: (config.app_secret as string) || "",
      };
    case "whatsapp":
      return base;
    default:
      return base;
  }
}

export function SettingsChannelsPage() {
  const { t } = useTranslation();
  const {
    instances,
    isLoading,
    error,
    createInstance,
    updateInstance,
    deleteInstance,
    toggleInstance,
  } = useChannelInstances();

  // Load agents for binding selector (use Gateway API)
  // All agents from useAgents are user-created agents
  const { agents } = useAgents();

  // Load executor sessions for binding selector (global workspace)
  const { sessions: executorSessions } = useExecutorSessions("CLAUDE_CODE", null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<GatewayChannel | null>(null);
  const [formState, setFormState] = useState<ChannelFormState>(() => getDefaultFormState("telegram"));
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingChannel, setTestingChannel] = useState<GatewayChannel | null>(null);
  const [testChatId, setTestChatId] = useState("");
  const [isSendingTestMessage, setIsSendingTestMessage] = useState(false);
  const [sendingTestMessageId, setSendingTestMessageId] = useState<string | null>(null);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form state when dialog opens/closes
  const handleOpenCreateDialog = () => {
    setFormState(getDefaultFormState("telegram"));
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setFormState(getDefaultFormState("telegram"));
  };

  const handleTypeChange = (type: ChannelType) => {
    setFormState(getDefaultFormState(type, formState.name));
  };

  const handleFormChange = (update: Partial<ChannelFormState>) => {
    setFormState((prev) => ({ ...prev, ...update }));
  };

  const handleCreate = async () => {
    if (!isFormValid(formState)) return;

    setIsCreating(true);
    try {
      const config = buildConfigFromForm(formState);
      await createInstance(formState.channel_type, formState.name.trim(), config, formState.agent_binding || undefined);
      handleCloseCreateDialog();
      toast.success(t("channels.createSuccess", "渠道创建成功"));
    } catch (err) {
      toast.error(t("channels.createFailed", "创建失败"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (channel: GatewayChannel) => {
    if (!confirm(t("channels.deleteConfirm", { name: channel.name }))) return;
    const success = await deleteInstance(channel.id);
    if (success) {
      toast.success(t("channels.deleteSuccess", "渠道已删除"));
    }
  };

  const handleOpenEditDialog = (channel: GatewayChannel) => {
    setEditingChannel(channel);
    setFormState(initFormStateFromChannel(channel));
  };

  const handleSaveEdit = async () => {
    if (!editingChannel || !isFormValid(formState)) return;

    setIsSaving(true);
    try {
      const config = buildConfigFromForm(formState);
      await updateInstance(editingChannel.id, {
        name: formState.name,
        config,
        agent_binding: formState.agent_binding,
      });
      setEditingChannel(null);
      toast.success(t("channels.updateSuccess", "渠道已更新"));
    } catch (err) {
      toast.error(t("channels.updateFailed", "更新失败"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection (no Chat ID required)
  const handleTestConnection = async (channel: GatewayChannel) => {
    setTestingConnectionId(channel.id);

    const result = await testChannelConnection(channel, t);

    setTestingConnectionId(null);

    if (result.success) {
      toast.success(t("channels.connectionSuccess", "Connection verified!"), {
        description: result.details,
      });
    } else {
      toast.error(
        `${t("channels.connectionFailed", "Connection failed")} - ${channel.name}`,
        {
          description: result.error,
          duration: 8000, // Show longer for errors
        }
      );
    }
  };

  // Open test message dialog
  const handleOpenTestDialog = (channel: GatewayChannel) => {
    setTestingChannel(channel);
    setTestChatId("");
    setTestDialogOpen(true);
  };

  // Send test message
  const handleSendTestMessage = async () => {
    if (!testingChannel) return;

    setIsSendingTestMessage(true);
    setSendingTestMessageId(testingChannel.id);

    const result = await sendTestMessage(testingChannel, testChatId || undefined, t);

    setIsSendingTestMessage(false);
    setSendingTestMessageId(null);

    if (result.success) {
      toast.success(t("channels.testSuccess", "Test message sent successfully!"));
      setTestDialogOpen(false);
    } else {
      toast.error(
        `${t("channels.testFailed", "Failed to send test message")} - ${testingChannel.name}`,
        {
          description: result.error,
          duration: 8000, // Show longer for errors
        }
      );
    }
  };

  // Get placeholder text for chat ID based on channel type
  const getTestChatIdPlaceholder = (type: string): string => {
    switch (type) {
      case "telegram":
        return t("channels.telegram.chatIdPlaceholder", "Enter Chat ID (e.g., 123456789 or @channel_username)");
      case "discord":
        return t("channels.discord.channelIdPlaceholder", "Enter Channel ID (e.g., 1234567890123456789)");
      case "feishu":
        return t("channels.feishu.chatIdPlaceholder", "Enter Open ID (ou_xxx), Chat ID (oc_xxx), or email");
      case "whatsapp":
        return t("channels.whatsapp.testHint", "WhatsApp will test bridge connection only");
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold font-serif mb-1">
            {t("settings.sections.channels", "消息渠道")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.channelsDescription", "配置 AI 智能体的通信渠道")}
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("channels.addChannel", "添加渠道")}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Channel Instances by Type */}
      {CHANNEL_TYPES.map((type) => {
        const typeChannels = instances.filter((i) => i.channel_type === type);
        if (typeChannels.length === 0) return null;

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 text-muted-foreground">
                {CHANNEL_ICONS[type]}
              </div>
              <h3 className="font-medium">{getChannelTypeName(type)}</h3>
              <span className="text-xs text-muted-foreground">
                ({typeChannels.length})
              </span>
            </div>
            <div className="space-y-2 pl-8">
              {typeChannels.map((channel) => (
                <InstanceCard
                  key={channel.id}
                  channel={channel}
                  onToggle={() => toggleInstance(channel.id)}
                  onEdit={() => handleOpenEditDialog(channel)}
                  onDelete={() => handleDelete(channel)}
                  onTestConnection={() => handleTestConnection(channel)}
                  onSendTestMessage={() => handleOpenTestDialog(channel)}
                  isTestingConnection={testingConnectionId === channel.id}
                  isSendingTestMessage={sendingTestMessageId === channel.id}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {instances.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t("channels.noChannels", "还没有配置任何渠道")}</p>
          <p className="text-sm mt-1">
            {t("channels.noChannelsHint", "点击上方按钮添加一个渠道")}
          </p>
        </div>
      )}

      {/* Create Dialog - includes all required fields for each channel type */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseCreateDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("channels.addChannel", "添加渠道")}</DialogTitle>
            <DialogDescription>
              {t("channels.addChannelDescFull", "选择渠道类型并填写必要信息")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Channel Type Selector */}
            <div className="space-y-2">
              <Label>{t("channels.channelType", "渠道类型")}</Label>
              <Select
                value={formState.channel_type}
                onValueChange={(v) => handleTypeChange(v as ChannelType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4">{CHANNEL_ICONS[type]}</span>
                        {getChannelTypeName(type)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type-specific form fields */}
            {formState.channel_type === "telegram" && (
              <TelegramForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {formState.channel_type === "discord" && (
              <DiscordForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {formState.channel_type === "feishu" && (
              <FeishuForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {formState.channel_type === "whatsapp" && (
              <WhatsAppForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}

            {/* Agent/Executor Binding */}
            <AgentBindingSelector
              value={formState.agent_binding}
              onChange={(binding) => handleFormChange({ agent_binding: binding })}
              agents={agents}
              executorSessions={executorSessions}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCreateDialog}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handleCreate} disabled={!isFormValid(formState) || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.creating", "创建中...")}
                </>
              ) : (
                t("common.create", "创建")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("channels.editChannel", "编辑渠道")} - {editingChannel?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {editingChannel?.channel_type === "telegram" && (
              <TelegramForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {editingChannel?.channel_type === "discord" && (
              <DiscordForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {editingChannel?.channel_type === "feishu" && (
              <FeishuForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}
            {editingChannel?.channel_type === "whatsapp" && (
              <WhatsAppForm
                formState={formState}
                onChange={handleFormChange}
              />
            )}

            {/* Agent/Executor Binding */}
            <AgentBindingSelector
              value={formState.agent_binding}
              onChange={(binding) => handleFormChange({ agent_binding: binding })}
              agents={agents}
              executorSessions={executorSessions}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChannel(null)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={!isFormValid(formState) || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving", "保存中...")}
                </>
              ) : (
                t("common.save", "保存")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Message Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("channels.sendTestMessage", "发送测试消息")}
            </DialogTitle>
            <DialogDescription>
              {t("channels.sendTestMessageDesc", "发送一条测试消息以验证渠道配置是否正确。")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {testingChannel && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="h-4 w-4 text-primary">
                      {CHANNEL_ICONS[testingChannel.channel_type]}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{testingChannel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getChannelTypeName(testingChannel.channel_type as ChannelType)}
                    </p>
                  </div>
                </div>

                {testingChannel.channel_type !== "whatsapp" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {testingChannel.channel_type === "telegram"
                        ? t("channels.telegram.chatId", "Chat ID")
                        : testingChannel.channel_type === "discord"
                        ? t("channels.discord.channelId", "Channel ID")
                        : t("channels.feishu.chatId", "接收者 ID")}
                    </Label>
                    <Input
                      value={testChatId}
                      onChange={(e) => setTestChatId(e.target.value)}
                      placeholder={getTestChatIdPlaceholder(testingChannel.channel_type)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {testingChannel.channel_type === "telegram" &&
                        t("channels.telegram.chatIdHint", "你可以从 @userinfobot 获取你的 Chat ID")}
                      {testingChannel.channel_type === "discord" &&
                        t("channels.discord.channelIdHint", "右键点击频道 > 复制频道 ID (需开启开发者模式)")}
                      {testingChannel.channel_type === "feishu" &&
                        t("channels.feishu.chatIdHint", "可以使用 Open ID (ou_xxx)、Chat ID (oc_xxx) 或邮箱")}
                    </p>
                  </div>
                )}

                {testingChannel.channel_type === "whatsapp" && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p>{t("channels.whatsapp.testNote", "WhatsApp 测试将验证 Bridge 服务器连接是否正常。实际发送消息需要完成 WhatsApp Web 认证。")}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button
              onClick={handleSendTestMessage}
              disabled={isSendingTestMessage || (testingChannel?.channel_type !== "whatsapp" && !testChatId.trim())}
            >
              {isSendingTestMessage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("channels.testing", "测试中...")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t("channels.sendTest", "发送测试")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
