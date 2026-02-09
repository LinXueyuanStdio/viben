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
import { useChannelInstances } from "@/hooks";
import { cn } from "@/lib/utils";
import type {
  ChannelType,
  ChannelInstance,
  TelegramInstance,
  DiscordInstance,
  FeishuInstance,
  WhatsAppInstance,
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

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  telegram: <TelegramIcon className="h-5 w-5" />,
  discord: <DiscordIcon className="h-5 w-5" />,
  feishu: <FeishuIcon className="h-5 w-5" />,
  whatsapp: <WhatsAppIcon className="h-5 w-5" />,
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

// Instance card component
interface InstanceCardProps {
  instance: ChannelInstance;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function InstanceCard({ instance, onToggle, onEdit, onDelete }: InstanceCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center",
            instance.enabled
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-muted"
          )}
        >
          <div
            className={cn(
              "h-4 w-4",
              instance.enabled
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            )}
          >
            {CHANNEL_ICONS[instance.type]}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">{instance.name}</p>
          <p className="text-xs text-muted-foreground">
            {getChannelTypeName(instance.type)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {instance.enabled ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch checked={instance.enabled} onCheckedChange={onToggle} />
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

// Telegram config form
function TelegramForm({
  instance,
  onChange,
}: {
  instance: TelegramInstance;
  onChange: (update: Partial<TelegramInstance>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={instance.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Telegram Bot"
        />
      </div>
      <SecretInput
        label={t("channels.telegram.token", "Bot Token")}
        description={t("channels.telegram.tokenDescription", "从 @BotFather 获取")}
        value={instance.token}
        onChange={(token) => onChange({ token })}
        placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.telegram.proxy", "代理 (可选)")}
        </Label>
        <Input
          value={instance.proxy || ""}
          onChange={(e) => onChange({ proxy: e.target.value || undefined })}
          placeholder="http://127.0.0.1:7890"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.telegram.allowFrom", "允许的用户 (可选)")}
        </Label>
        <Input
          value={instance.allow_from.join(", ")}
          onChange={(e) =>
            onChange({
              allow_from: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="user_id1, username2"
        />
      </div>
    </div>
  );
}

// Discord config form
function DiscordForm({
  instance,
  onChange,
}: {
  instance: DiscordInstance;
  onChange: (update: Partial<DiscordInstance>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={instance.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Discord Bot"
        />
      </div>
      <SecretInput
        label={t("channels.discord.token", "Bot Token")}
        description={t("channels.discord.tokenDescription", "从 Discord Developer Portal 获取")}
        value={instance.token}
        onChange={(token) => onChange({ token })}
        placeholder="MTIzNDU2Nzg5..."
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.discord.allowFrom", "允许的用户 (可选)")}
        </Label>
        <Input
          value={instance.allow_from.join(", ")}
          onChange={(e) =>
            onChange({
              allow_from: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="user_id1, user_id2"
        />
      </div>
    </div>
  );
}

// Feishu config form
function FeishuForm({
  instance,
  onChange,
}: {
  instance: FeishuInstance;
  onChange: (update: Partial<FeishuInstance>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={instance.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Feishu Bot"
        />
      </div>
      <SecretInput
        label={t("channels.feishu.appId", "App ID")}
        description={t("channels.feishu.appIdDescription", "从飞书开放平台获取")}
        value={instance.app_id}
        onChange={(app_id) => onChange({ app_id })}
        placeholder="cli_xxxxx"
      />
      <SecretInput
        label={t("channels.feishu.appSecret", "App Secret")}
        value={instance.app_secret}
        onChange={(app_secret) => onChange({ app_secret })}
        placeholder="xxxxxxxx"
      />
      <SecretInput
        label={t("channels.feishu.encryptKey", "Encrypt Key (可选)")}
        value={instance.encrypt_key}
        onChange={(encrypt_key) => onChange({ encrypt_key })}
        placeholder=""
      />
      <SecretInput
        label={t("channels.feishu.verificationToken", "Verification Token (可选)")}
        value={instance.verification_token}
        onChange={(verification_token) => onChange({ verification_token })}
        placeholder=""
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.feishu.allowFrom", "允许的用户 (可选)")}
        </Label>
        <Input
          value={instance.allow_from.join(", ")}
          onChange={(e) =>
            onChange({
              allow_from: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="ou_xxxxx"
        />
      </div>
    </div>
  );
}

// WhatsApp config form
function WhatsAppForm({
  instance,
  onChange,
}: {
  instance: WhatsAppInstance;
  onChange: (update: Partial<WhatsAppInstance>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("channels.instanceName", "实例名称")}</Label>
        <Input
          value={instance.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My WhatsApp Bridge"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.whatsapp.bridgeUrl", "Bridge URL")}
        </Label>
        <Input
          value={instance.bridge_url}
          onChange={(e) => onChange({ bridge_url: e.target.value })}
          placeholder="ws://localhost:3001"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("channels.whatsapp.allowFrom", "允许的手机号 (可选)")}
        </Label>
        <Input
          value={instance.allow_from.join(", ")}
          onChange={(e) =>
            onChange({
              allow_from: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="+86138xxxx, +1555xxxx"
        />
      </div>
    </div>
  );
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ChannelInstance | null>(null);
  const [newChannelType, setNewChannelType] = useState<ChannelType>("telegram");
  const [newChannelName, setNewChannelName] = useState("");

  const handleCreate = () => {
    if (!newChannelName.trim()) return;
    const instance = createInstance(newChannelType, newChannelName.trim());
    setCreateDialogOpen(false);
    setNewChannelName("");
    // Immediately open edit dialog for the new instance
    setEditingInstance(instance);
  };

  const handleDelete = (instance: ChannelInstance) => {
    if (!confirm(t("channels.deleteConfirm", { name: instance.name }))) return;
    deleteInstance(instance.id);
  };

  const handleSaveEdit = () => {
    setEditingInstance(null);
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
        <Button onClick={() => setCreateDialogOpen(true)}>
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
        const typeInstances = instances.filter((i) => i.type === type);
        if (typeInstances.length === 0) return null;

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 text-muted-foreground">
                {CHANNEL_ICONS[type]}
              </div>
              <h3 className="font-medium">{getChannelTypeName(type)}</h3>
              <span className="text-xs text-muted-foreground">
                ({typeInstances.length})
              </span>
            </div>
            <div className="space-y-2 pl-8">
              {typeInstances.map((instance) => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  onToggle={() => toggleInstance(instance.id)}
                  onEdit={() => setEditingInstance(instance)}
                  onDelete={() => handleDelete(instance)}
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("channels.addChannel", "添加渠道")}</DialogTitle>
            <DialogDescription>
              {t("channels.addChannelDesc", "选择渠道类型并设置名称")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("channels.channelType", "渠道类型")}</Label>
              <Select
                value={newChannelType}
                onValueChange={(v) => setNewChannelType(v as ChannelType)}
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
            <div className="space-y-2">
              <Label>{t("channels.instanceName", "实例名称")}</Label>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder={`My ${getChannelTypeName(newChannelType)} Bot`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handleCreate} disabled={!newChannelName.trim()}>
              {t("common.create", "创建")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingInstance} onOpenChange={(open) => !open && setEditingInstance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("channels.editChannel", "编辑渠道")} - {editingInstance?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {editingInstance?.type === "telegram" && (
              <TelegramForm
                instance={editingInstance as TelegramInstance}
                onChange={(update) =>
                  updateInstance(editingInstance.id, update)
                }
              />
            )}
            {editingInstance?.type === "discord" && (
              <DiscordForm
                instance={editingInstance as DiscordInstance}
                onChange={(update) =>
                  updateInstance(editingInstance.id, update)
                }
              />
            )}
            {editingInstance?.type === "feishu" && (
              <FeishuForm
                instance={editingInstance as FeishuInstance}
                onChange={(update) =>
                  updateInstance(editingInstance.id, update)
                }
              />
            )}
            {editingInstance?.type === "whatsapp" && (
              <WhatsAppForm
                instance={editingInstance as WhatsAppInstance}
                onChange={(update) =>
                  updateInstance(editingInstance.id, update)
                }
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit}>
              {t("common.save", "保存")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
