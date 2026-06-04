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
  Link,
  Copy,
  ExternalLink,
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
import { useExecutorSessions } from "@/pages/conversation/hooks/use-executor-sessions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GatewayError, getGatewayClient } from "@/lib/gateway";
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

function formatGatewayStatusError(error: unknown): string | null {
  if (error instanceof GatewayError && error.statusCode) {
    return `Gateway returned ${error.statusCode}: ${error.message}`;
  }

  return null;
}

/**
 * Format error message for display
 */
function formatChannelError(
  error: string | undefined,
  channelType: ChannelType,
): string {
  if (!error) return "Unknown error";

  // Common error patterns with user-friendly messages
  const errorLower = error.toLowerCase();

  // Network errors
  if (errorLower.includes("fetch") || errorLower.includes("network") || errorLower.includes("econnrefused")) {
    return "Network error: Unable to connect. Please check your internet connection.";
  }

  // Gateway not running
  if (errorLower.includes("failed to fetch") || errorLower.includes("connection refused")) {
    return "Gateway not running. Please start the gateway service first.";
  }

  // Timeout
  if (errorLower.includes("timeout")) {
    return "Request timed out. The service may be slow or unreachable.";
  }

  // Channel-specific error formatting
  switch (channelType) {
    case "telegram":
      if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
        return "Invalid Bot Token. Please check your token from @BotFather.";
      }
      if (errorLower.includes("chat not found") || errorLower.includes("400")) {
        return "Chat not found. Make sure you've sent /start to the bot first.";
      }
      if (errorLower.includes("bot was blocked")) {
        return "Bot was blocked by the user. Please unblock the bot in Telegram.";
      }
      break;
    case "discord":
      if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
        return "Invalid Bot Token. Please check your token from Discord Developer Portal.";
      }
      if (errorLower.includes("unknown channel") || errorLower.includes("404")) {
        return "Channel not found. Please verify the Channel ID.";
      }
      if (errorLower.includes("missing access") || errorLower.includes("403")) {
        return "Bot lacks permission. Invite the bot to the channel first.";
      }
      break;
    case "feishu":
      if (errorLower.includes("invalid app_id") || errorLower.includes("10003")) {
        return "Invalid App ID. Please check your credentials from Feishu Open Platform.";
      }
      if (errorLower.includes("app_secret") || errorLower.includes("10014")) {
        return "Invalid App Secret. Please verify your credentials.";
      }
      if (errorLower.includes("user_not_found") || errorLower.includes("230001")) {
        return "User not found. Please check the Open ID or Chat ID.";
      }
      break;
    case "whatsapp":
      if (errorLower.includes("websocket") || errorLower.includes("ws://")) {
        return "Cannot connect to WhatsApp Bridge. Is the bridge server running?";
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
): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const data = await getGatewayClient().post<{
      success: boolean;
      details?: string;
      error?: string;
    }>(
      "/api/channels/test",
      {
        channel_type: channel.channel_type,
        config: buildChannelConfig(channel),
      }
    );

    return {
      success: data.success,
      details: data.details,
      error: data.error ? formatChannelError(data.error, channel.channel_type) : undefined,
    };
  } catch (error) {
    const gatewayError = formatGatewayStatusError(error);
    if (gatewayError) {
      return {
        success: false,
        error: gatewayError,
      };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: formatChannelError(errorMsg, channel.channel_type),
    };
  }
}

/**
 * Send a test message via gateway API (requires Chat ID)
 */
async function sendTestMessage(
  channel: GatewayChannel,
  chatId: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  if (!chatId && channel.channel_type !== "whatsapp") {
    return { success: false, error: "Chat ID is required" };
  }

  try {
    const data = await getGatewayClient().post<{
      success: boolean;
      error?: string;
    }>(
      "/api/channels/send-test",
      {
        channel_type: channel.channel_type,
        config: buildChannelConfig(channel),
        chat_id: chatId || "",
      }
    );

    return {
      success: data.success,
      error: data.error ? formatChannelError(data.error, channel.channel_type) : undefined,
    };
  } catch (error) {
    const gatewayError = formatGatewayStatusError(error);
    if (gatewayError) {
      return {
        success: false,
        error: gatewayError,
      };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: formatChannelError(errorMsg, channel.channel_type),
    };
  }
}

// ============================================================================
// Telegram Webhook API Functions
// ============================================================================

interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Get Telegram webhook info
 */
async function getTelegramWebhookInfo(token: string): Promise<{
  success: boolean;
  result?: TelegramWebhookInfo;
  error?: string;
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();

    if (data.ok) {
      return { success: true, result: data.result };
    } else {
      return { success: false, error: data.description || "Failed to get webhook info" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set Telegram webhook
 */
async function setTelegramWebhook(
  token: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });
    const data = await response.json();

    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || "Failed to set webhook" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete Telegram webhook
 */
async function deleteTelegramWebhook(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const data = await response.json();

    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || "Failed to delete webhook" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Tunnel API Functions
// ============================================================================

type TunnelStatus = "stopped" | "starting" | "connected" | "error" | "reconnecting";

interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  port: number;
  connections: Array<{ id: string; ip: string; location: string }>;
  error: string | null;
  startedAt: number | null;
  lastConnectedAt: number | null;
  available: boolean;
}

/**
 * Get tunnel status
 */
async function getTunnelStatus(): Promise<TunnelState | null> {
  try {
    return await getGatewayClient().get<TunnelState>("/api/tunnel/status");
  } catch {
    return null;
  }
}

/**
 * Start tunnel
 */
async function startTunnel(port: number = 18790): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  state?: TunnelState;
}> {
  try {
    const response = await getGatewayClient().request<Response>("/api/tunnel/start", {
      method: "POST",
      body: { port },
      responseType: "response",
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop tunnel
 */
async function stopTunnel(): Promise<{ success: boolean; error?: string }> {
  try {
    return await getGatewayClient().request<{ success: boolean; error?: string }>("/api/tunnel/stop", {
      method: "POST",
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
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
  onConfigureWebhook?: () => void;
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
  onConfigureWebhook,
  isTestingConnection,
  isSendingTestMessage,
}: InstanceCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
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
              {t("channels.default", "Default")}
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
        {/* Webhook config button for Telegram */}
        {channel.channel_type === "telegram" && onConfigureWebhook && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            onClick={onConfigureWebhook}
            title={t("channels.configureWebhook", "Configure Webhook")}
          >
            <Link className="h-4 w-4" />
          </Button>
        )}
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
        <Label>{t("channels.instanceName", "Instance Name")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.telegram.instancePlaceholder", "My Telegram Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.telegram.token", "Bot Token")}
        description={t("channels.telegram.tokenDescription", "Get from @BotFather")}
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
          {t("channels.telegram.chatIdDescription", "Target chat ID for sending messages, get from @userinfobot")}
        </p>
        <Input
          value={chat_id}
          onChange={(e) => onChange({ chat_id: e.target.value })}
          placeholder={t("channels.telegram.chatIdExamplePlaceholder", "123456789")}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.telegram.proxy", "Proxy (Optional)")}
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
        <Label>{t("channels.instanceName", "Instance Name")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.discord.instancePlaceholder", "My Discord Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.discord.token", "Bot Token")}
        description={t("channels.discord.tokenDescription", "Get from Discord Developer Portal")}
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
        <Label>{t("channels.instanceName", "Instance Name")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.feishu.instancePlaceholder", "My Feishu Bot")}
        />
      </div>
      <SecretInput
        label={t("channels.feishu.appId", "App ID")}
        description={t("channels.feishu.appIdDescription", "Get from Feishu Open Platform")}
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
        <Label>{t("channels.instanceName", "Instance Name")}</Label>
        <Input
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("channels.whatsapp.instancePlaceholder", "My WhatsApp Bridge")}
        />
      </div>
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>{t("channels.whatsapp.note", "WhatsApp requires a Bridge server configuration.")}</p>
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
        {t("channels.agentBinding", "Bind Agent/Executor")}
      </Label>
      <p className="text-xs text-muted-foreground/70">
        {t("channels.agentBindingDescription", "Automatically route received messages to the specified agent or executor")}
      </p>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("channels.noBinding", "No Binding")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("channels.noBinding", "No Binding")}</SelectItem>
          {agents.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                {t("channels.agents", "Agents")}
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
                {t("channels.executors", "Executors (Claude Code)")}
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

  // Webhook configuration state
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookChannel, setWebhookChannel] = useState<GatewayChannel | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookInfo, setWebhookInfo] = useState<TelegramWebhookInfo | null>(null);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  // Tunnel state
  const [tunnelState, setTunnelState] = useState<TunnelState | null>(null);
  const [isStartingTunnel, setIsStartingTunnel] = useState(false);
  const [isStoppingTunnel, setIsStoppingTunnel] = useState(false);

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
      toast.success(t("channels.createSuccess", "Channel created successfully"));
    } catch (err) {
      toast.error(t("channels.createFailed", "Creation failed"), {
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
      toast.success(t("channels.deleteSuccess", "Channel deleted"));
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
      toast.success(t("channels.updateSuccess", "Channel updated"));
    } catch (err) {
      toast.error(t("channels.updateFailed", "Update failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection (no Chat ID required)
  const handleTestConnection = async (channel: GatewayChannel) => {
    setTestingConnectionId(channel.id);

    const result = await testChannelConnection(channel);

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

    const result = await sendTestMessage(testingChannel, testChatId || undefined);

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

  // Open webhook configuration dialog
  const handleOpenWebhookDialog = async (channel: GatewayChannel) => {
    setWebhookChannel(channel);
    setWebhookDialogOpen(true);
    setWebhookInfo(null);
    setTunnelState(null);

    // Get token from channel config
    const config = channel.config as Record<string, unknown>;
    const token = config.token as string;

    if (!token) {
      toast.error(t("channels.webhook.noToken", "Please configure the Bot Token first"));
      return;
    }

    // Generate default webhook URL
    const gatewayUrl = getGatewayClient().getBaseUrl();
    const defaultWebhookUrl = `${gatewayUrl}/api/channels/webhook`;
    setWebhookUrl(defaultWebhookUrl);

    // Load current webhook info and tunnel status in parallel
    setIsLoadingWebhook(true);
    const [webhookResult, tunnelStatus] = await Promise.all([
      getTelegramWebhookInfo(token),
      getTunnelStatus(),
    ]);
    setIsLoadingWebhook(false);

    if (webhookResult.success && webhookResult.result) {
      setWebhookInfo(webhookResult.result);
      if (webhookResult.result.url) {
        setWebhookUrl(webhookResult.result.url);
      }
    }

    if (tunnelStatus) {
      setTunnelState(tunnelStatus);
      // If tunnel is connected, use tunnel URL
      if (tunnelStatus.status === "connected" && tunnelStatus.url) {
        setWebhookUrl(`${tunnelStatus.url}/api/channels/webhook`);
      }
    }
  };

  // Set webhook
  const handleSetWebhook = async () => {
    if (!webhookChannel || !webhookUrl) return;

    const config = webhookChannel.config as Record<string, unknown>;
    const token = config.token as string;

    if (!token) {
      toast.error(t("channels.webhook.noToken", "Please configure the Bot Token first"));
      return;
    }

    setIsSettingWebhook(true);
    const result = await setTelegramWebhook(token, webhookUrl);
    setIsSettingWebhook(false);

    if (result.success) {
      toast.success(t("channels.webhook.setSuccess", "Webhook set successfully"));
      // Refresh webhook info
      const infoResult = await getTelegramWebhookInfo(token);
      if (infoResult.success && infoResult.result) {
        setWebhookInfo(infoResult.result);
      }
    } else {
      toast.error(t("channels.webhook.setFailed", "Failed to set Webhook"), {
        description: result.error,
      });
    }
  };

  // Delete webhook
  const handleDeleteWebhook = async () => {
    if (!webhookChannel) return;

    const config = webhookChannel.config as Record<string, unknown>;
    const token = config.token as string;

    if (!token) return;

    setIsSettingWebhook(true);
    const result = await deleteTelegramWebhook(token);
    setIsSettingWebhook(false);

    if (result.success) {
      toast.success(t("channels.webhook.deleteSuccess", "Webhook deleted"));
      setWebhookInfo(null);
      setWebhookUrl("");
    } else {
      toast.error(t("channels.webhook.deleteFailed", "Delete failed"), {
        description: result.error,
      });
    }
  };

  // Copy webhook URL to clipboard
  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success(t("channels.webhook.copied", "Copied to clipboard"));
  };

  // Start tunnel
  const handleStartTunnel = async () => {
    setIsStartingTunnel(true);
    const result = await startTunnel(18790);
    setIsStartingTunnel(false);

    if (result.success && result.url) {
      const tunnelWebhookUrl = `${result.url}/api/channels/webhook`;
      setWebhookUrl(tunnelWebhookUrl);
      setTunnelState(result.state || null);
      toast.success(t("channels.tunnel.started", "Tunnel started"), {
        description: result.url,
      });
    } else {
      toast.error(t("channels.tunnel.startFailed", "Failed to start tunnel"), {
        description: result.error,
      });
      if (result.state) {
        setTunnelState(result.state);
      }
    }
  };

  // Stop tunnel
  const handleStopTunnel = async () => {
    setIsStoppingTunnel(true);
    const result = await stopTunnel();
    setIsStoppingTunnel(false);

    if (result.success) {
      setTunnelState((prev) => prev ? { ...prev, status: "stopped", url: null } : null);
      // Reset to local URL
      const gatewayUrl = getGatewayClient().getBaseUrl();
      setWebhookUrl(`${gatewayUrl}/api/channels/webhook`);
      toast.success(t("channels.tunnel.stopped", "Tunnel stopped"));
    } else {
      toast.error(t("channels.tunnel.stopFailed", "Failed to stop tunnel"), {
        description: result.error,
      });
    }
  };

  // One-click setup: start tunnel + set webhook
  const handleOneClickSetup = async () => {
    if (!webhookChannel) return;

    const config = webhookChannel.config as Record<string, unknown>;
    const token = config.token as string;

    if (!token) {
      toast.error(t("channels.webhook.noToken", "Please configure the Bot Token first"));
      return;
    }

    // Step 1: Start tunnel
    setIsStartingTunnel(true);
    const tunnelResult = await startTunnel(18790);
    setIsStartingTunnel(false);

    if (!tunnelResult.success || !tunnelResult.url) {
      toast.error(t("channels.tunnel.startFailed", "Failed to start tunnel"), {
        description: tunnelResult.error,
      });
      return;
    }

    const tunnelWebhookUrl = `${tunnelResult.url}/api/channels/webhook`;
    setWebhookUrl(tunnelWebhookUrl);
    setTunnelState(tunnelResult.state || null);

    // Step 2: Set webhook
    setIsSettingWebhook(true);
    const webhookResult = await setTelegramWebhook(token, tunnelWebhookUrl);
    setIsSettingWebhook(false);

    if (webhookResult.success) {
      toast.success(t("channels.webhook.oneClickSuccess", "One-click setup successful!"), {
        description: t("channels.webhook.oneClickSuccessDesc", "Tunnel started and Webhook configured"),
      });
      // Refresh webhook info
      const infoResult = await getTelegramWebhookInfo(token);
      if (infoResult.success && infoResult.result) {
        setWebhookInfo(infoResult.result);
      }
    } else {
      toast.error(t("channels.webhook.setFailed", "Failed to set Webhook"), {
        description: webhookResult.error,
      });
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
            {t("settings.sections.channels", "Channels")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.channelsDescription", "Configure communication channels for AI agents")}
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("channels.addChannel", "Add Channel")}
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
                  onConfigureWebhook={channel.channel_type === "telegram" ? () => handleOpenWebhookDialog(channel) : undefined}
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
          <p>{t("channels.noChannels", "No channels configured yet")}</p>
          <p className="text-sm mt-1">
            {t("channels.noChannelsHint", "Click the button above to add a channel")}
          </p>
        </div>
      )}

      {/* Create Dialog - includes all required fields for each channel type */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseCreateDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("channels.addChannel", "Add Channel")}</DialogTitle>
            <DialogDescription>
              {t("channels.addChannelDescFull", "Select channel type and fill in the required information")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Channel Type Selector */}
            <div className="space-y-2">
              <Label>{t("channels.channelType", "Channel Type")}</Label>
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
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!isFormValid(formState) || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.creating", "Creating...")}
                </>
              ) : (
                t("common.create", "Create")
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
              {t("channels.editChannel", "Edit Channel")} - {editingChannel?.name}
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
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={!isFormValid(formState) || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving", "Saving...")}
                </>
              ) : (
                t("common.save", "Save")
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
              {t("channels.sendTestMessage", "Send Test Message")}
            </DialogTitle>
            <DialogDescription>
              {t("channels.sendTestMessageDesc", "Send a test message to verify the channel configuration.")}
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
                        : t("channels.feishu.chatId", "Recipient ID")}
                    </Label>
                    <Input
                      value={testChatId}
                      onChange={(e) => setTestChatId(e.target.value)}
                      placeholder={getTestChatIdPlaceholder(testingChannel.channel_type)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {testingChannel.channel_type === "telegram" &&
                        t("channels.telegram.chatIdHint", "You can get your Chat ID from @userinfobot")}
                      {testingChannel.channel_type === "discord" &&
                        t("channels.discord.channelIdHint", "Right-click channel > Copy Channel ID (Developer Mode required)")}
                      {testingChannel.channel_type === "feishu" &&
                        t("channels.feishu.chatIdHint", "You can use Open ID (ou_xxx), Chat ID (oc_xxx), or email")}
                    </p>
                  </div>
                )}

                {testingChannel.channel_type === "whatsapp" && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p>{t("channels.whatsapp.testNote", "WhatsApp test will verify the Bridge server connection. Actual message sending requires WhatsApp Web authentication.")}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSendTestMessage}
              disabled={isSendingTestMessage || (testingChannel?.channel_type !== "whatsapp" && !testChatId.trim())}
            >
              {isSendingTestMessage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("channels.testing", "Testing...")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t("channels.sendTest", "Send Test")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Configuration Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              {t("channels.webhook.title", "Configure Webhook")}
            </DialogTitle>
            <DialogDescription>
              {t("channels.webhook.description", "Configure the Telegram Bot Webhook so the bot can receive messages and route them to the bound agent.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {webhookChannel && (
              <>
                {/* Channel Info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <TelegramIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{webhookChannel.name}</p>
                    <p className="text-xs text-muted-foreground">{t("channels.telegramBot")}</p>
                  </div>
                </div>

                {/* Current Webhook Status */}
                {isLoadingWebhook ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {t("channels.webhook.loading", "Loading...")}
                    </span>
                  </div>
                ) : webhookInfo ? (
                  <div className="space-y-2 p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {t("channels.webhook.currentStatus", "Current Status")}
                      </span>
                      {webhookInfo.url ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("channels.webhook.active", "Configured")}
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t("channels.webhook.notConfigured", "Not Configured")}
                        </span>
                      )}
                    </div>
                    {webhookInfo.url && (
                      <div className="text-xs text-muted-foreground break-all">
                        {webhookInfo.url}
                      </div>
                    )}
                    {webhookInfo.last_error_message && (
                      <div className="text-xs text-destructive flex items-start gap-1">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        {webhookInfo.last_error_message}
                      </div>
                    )}
                    {webhookInfo.pending_update_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {t("channels.webhook.pendingUpdates", "Pending updates")}: {webhookInfo.pending_update_count}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Webhook URL Input */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("channels.webhook.url", "Webhook URL")}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder={t("placeholders.webhookUrl")}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyWebhookUrl}
                      title={t("channels.webhook.copy", "Copy")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("channels.webhook.urlHint", "Webhook URL must be a publicly accessible HTTPS address. For local development, use tools like ngrok.")}
                  </p>
                </div>

                {/* Tunnel Section */}
                <div className="space-y-3 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t("channels.tunnel.title", "Cloudflare Tunnel")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("channels.tunnel.description", "Create a public URL with one click, no extra tools required")}
                      </p>
                    </div>
                    {tunnelState?.status === "connected" ? (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("channels.tunnel.connected", "Connected")}
                      </span>
                    ) : tunnelState?.status === "starting" || tunnelState?.status === "reconnecting" ? (
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {tunnelState.status === "starting"
                          ? t("channels.tunnel.starting", "Starting...")
                          : t("channels.tunnel.reconnecting", "Reconnecting...")}
                      </span>
                    ) : tunnelState?.status === "error" ? (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {t("channels.tunnel.error", "Error")}
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {t("channels.tunnel.stopped", "Stopped")}
                      </span>
                    )}
                  </div>

                  {/* Tunnel URL */}
                  {tunnelState?.url && (
                    <div className="text-xs text-muted-foreground break-all p-2 bg-muted/50 rounded">
                      {tunnelState.url}
                    </div>
                  )}

                  {/* Tunnel Error */}
                  {tunnelState?.error && (
                    <div className="text-xs text-destructive flex items-start gap-1">
                      <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {tunnelState.error}
                    </div>
                  )}

                  {/* Tunnel Connections */}
                  {tunnelState?.connections && tunnelState.connections.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {t("channels.tunnel.connections", "Connection points")}: {tunnelState.connections.map(c => c.location).join(", ")}
                    </div>
                  )}

                  {/* Tunnel Actions */}
                  <div className="flex gap-2">
                    {tunnelState?.status === "connected" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopTunnel}
                        disabled={isStoppingTunnel}
                        className="flex-1"
                      >
                        {isStoppingTunnel ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t("channels.tunnel.stopping", "Stopping...")}
                          </>
                        ) : (
                          t("channels.tunnel.stop", "Stop Tunnel")
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartTunnel}
                        disabled={isStartingTunnel || tunnelState?.status === "starting"}
                        className="flex-1"
                      >
                        {isStartingTunnel || tunnelState?.status === "starting" ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t("channels.tunnel.starting", "Starting...")}
                          </>
                        ) : (
                          t("channels.tunnel.start", "Start Tunnel")
                        )}
                      </Button>
                    )}
                    {/* One-click setup button */}
                    {tunnelState?.status !== "connected" && (
                      <Button
                        size="sm"
                        onClick={handleOneClickSetup}
                        disabled={isStartingTunnel || isSettingWebhook}
                        className="flex-1"
                      >
                        {(isStartingTunnel || isSettingWebhook) ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t("channels.tunnel.settingUp", "Setting up...")}
                          </>
                        ) : (
                          t("channels.tunnel.oneClick", "One-Click Setup")
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Manual Help Section */}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                    {t("channels.webhook.manualSetup", "Manual Setup")}
                  </summary>
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 space-y-2">
                    <ul className="text-muted-foreground space-y-1">
                      <li className="flex items-center gap-1">
                        <span>•</span>
                        <span>ngrok: <code className="bg-muted px-1 rounded">ngrok http 18790</code></span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span>•</span>
                        <span>cloudflared: <code className="bg-muted px-1 rounded">cloudflared tunnel --url http://localhost:18790</code></span>
                      </li>
                    </ul>
                    <a
                      href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {t("channels.webhook.learnMore", "Learn More")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </details>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {webhookInfo?.url && (
              <Button
                variant="outline"
                onClick={handleDeleteWebhook}
                disabled={isSettingWebhook}
                className="text-destructive hover:text-destructive"
              >
                {t("channels.webhook.delete", "Delete Webhook")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={handleSetWebhook}
                disabled={isSettingWebhook || !webhookUrl.trim()}
              >
                {isSettingWebhook ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("channels.webhook.setting", "Setting...")}
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    {t("channels.webhook.set", "Set Webhook")}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
