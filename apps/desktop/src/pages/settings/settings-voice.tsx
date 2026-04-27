import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVoiceStore } from "@/stores/voice-store";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { useWakeWord } from "@/hooks/use-wake-word";
import { loadVoiceConfig, saveVoiceConfig } from "@/lib/voice/secure-config";
import { Loader2, Save, RotateCcw, Mic, MicOff, Square, AudioWaveform, CheckCircle2 } from "lucide-react";
import { SettingsItem, SectionHeader } from "./components";

/**
 * 预热麦克风权限
 * 在设置页面加载时提前请求麦克风权限，避免点击测试按钮时的延迟
 */
async function warmupMicrophonePermission(): Promise<void> {
  try {
    // 检查是否已有权限（不会弹出提示）
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (result.state === "granted") {
      console.log("[SettingsVoice] Microphone permission already granted");
      return;
    }

    // 如果权限是 prompt 状态，我们不在这里请求，避免意外弹窗
    // 用户点击测试按钮时再请求
    console.log("[SettingsVoice] Microphone permission state:", result.state);
  } catch (err) {
    // permissions API 可能不支持 microphone，忽略错误
    console.log("[SettingsVoice] Permissions API not available for microphone");
  }
}

export function SettingsVoice() {
  const { t } = useTranslation();
  const store = useVoiceStore();
  const voiceAgent = useVoiceAgent();

  const [apiKey, setApiKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Wake word test state
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [lastDetection, setLastDetection] = useState<{ keyword: string; score: number } | null>(null);
  const [wakeWordError, setWakeWordError] = useState<string | null>(null);

  const wakeWord = useWakeWord(
    (detection) => {
      setWakeWordDetected(true);
      setLastDetection({ keyword: detection.keyword, score: detection.score });
      // Reset detected state after 2 seconds
      setTimeout(() => setWakeWordDetected(false), 2000);
    },
    { threshold: store.config.wakeWordThreshold }
  );

  const { config, actions } = store;

  // Load config on mount + warmup microphone permission
  useEffect(() => {
    setIsLoading(true);

    // 并行执行：加载配置 + 预热麦克风权限
    Promise.all([
      loadVoiceConfig(),
      warmupMicrophonePermission(),
    ])
      .then(([loadedConfig]) => {
        actions.setConfig(loadedConfig);
        setApiKey(loadedConfig.vocalBridgeApiKey || "");
        setAgentId(loadedConfig.vocalBridgeAgentId || "");
        actions.setConfigLoaded(true);
        setHasChanges(false);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [actions]);

  // Save config
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const newConfig = { ...config, vocalBridgeApiKey: apiKey, vocalBridgeAgentId: agentId };
      actions.setConfig({ vocalBridgeApiKey: apiKey, vocalBridgeAgentId: agentId });
      await saveVoiceConfig(newConfig);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, agentId, config, actions]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setApiKey("");
    setAgentId("");
    actions.setConfig({
      wakeWord: "你好微本",
      autoStartOnLaunch: false,
      silenceTimeout: 30,
      enableSoundEffects: true,
      wakeWordThreshold: 0.5,
    });
    setHasChanges(true);
  }, [actions]);

  // Test connection toggle
  const handleTestToggle = useCallback(async () => {
    if (voiceAgent.isConnected) {
      voiceAgent.disconnect();
    } else {
      // 确保使用最新输入的 API Key 和 Agent ID（即使尚未保存）
      actions.setConfig({ vocalBridgeApiKey: apiKey, vocalBridgeAgentId: agentId });
      await voiceAgent.connect();
    }
  }, [voiceAgent, apiKey, agentId, actions]);

  // Wake word test toggle
  const handleWakeWordTestToggle = useCallback(async () => {
    setWakeWordError(null);
    if (wakeWord.isListening) {
      wakeWord.stop();
      setLastDetection(null);
    } else {
      // Load and activate the selected wake word
      const selectedWakeWord = config.wakeWord === "你好微本" ? "nihao_weiben" : "hey_jarvis";
      try {
        await wakeWord.loadKeyword(selectedWakeWord);
        wakeWord.setActiveKeywords([selectedWakeWord]);
        await wakeWord.start();
      } catch (err) {
        console.error("Failed to start wake word detection:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("Failed to fetch")) {
          setWakeWordError(t("settings.voice.wakeWord.test.modelNotFound", "唤醒词模型文件未找到，请先下载模型"));
        } else {
          setWakeWordError(errorMsg);
        }
      }
    }
  }, [wakeWord, config.wakeWord, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold font-serif mb-1">
            {t("settings.sections.voice", "语音交互")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.voice.description", "配置语音助手和唤醒词检测")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("common.reset", "重置")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("common.save", "保存")}
          </Button>
        </div>
      </div>

      {/* API Config Card */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.voice.api.title", "API 配置")} />

        <SettingsItem
          title={t("settings.voice.api.vocalBridgeKey", "Vocal Bridge API Key")}
          description={t(
            "settings.voice.api.vocalBridgeKeyDesc",
            "用于连接语音服务的 API 密钥"
          )}
        >
          <div className="flex items-center gap-2">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setHasChanges(true);
              }}
              placeholder="vb_..."
              className="w-48"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey
                ? t("common.hide", "隐藏")
                : t("common.show", "显示")}
            </Button>
          </div>
        </SettingsItem>

        <SettingsItem
          title={t("settings.voice.api.agentId", "Agent ID")}
          description={t(
            "settings.voice.api.agentIdDesc",
            "Vocal Bridge 语音智能体 ID"
          )}
        >
          <Input
            type="text"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              setHasChanges(true);
            }}
            placeholder="agent_..."
            className="w-48"
          />
        </SettingsItem>
      </div>

      {/* Wake Word Settings Card */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader
          title={t("settings.voice.wakeWord.title", "唤醒词设置")}
        />

        <SettingsItem
          title={t("settings.voice.wakeWord.word", "唤醒词")}
          description={t(
            "settings.voice.wakeWord.wordDesc",
            "说出这个词来激活语音助手"
          )}
        >
          <Select
            value={config.wakeWord}
            onValueChange={(value) => {
              actions.setConfig({ wakeWord: value });
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="你好微本">{t("settings.voice.wakeWord.options.nihaoWeiben", "你好微本")}</SelectItem>
              <SelectItem value="hey_jarvis">{t("settings.voice.wakeWord.options.heyJarvis", "Hey Jarvis")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.voice.wakeWord.threshold", "检测灵敏度")}
          description={t(
            "settings.voice.wakeWord.thresholdDesc",
            "唤醒词检测的置信度阈值"
          )}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[config.wakeWordThreshold]}
              onValueChange={([val]) => {
                actions.setConfig({ wakeWordThreshold: val });
                setHasChanges(true);
              }}
              min={0.1}
              max={0.9}
              step={0.1}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10 text-right">
              {config.wakeWordThreshold.toFixed(1)}
            </span>
          </div>
        </SettingsItem>

        <SettingsItem
          title={t("settings.voice.wakeWord.autoStart", "启动时自动监听")}
          description={t(
            "settings.voice.wakeWord.autoStartDesc",
            "应用启动后自动开始监听唤醒词"
          )}
        >
          <Switch
            checked={config.autoStartOnLaunch}
            onCheckedChange={(checked) => {
              actions.setConfig({ autoStartOnLaunch: checked });
              setHasChanges(true);
            }}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.voice.wakeWord.silenceTimeout", "静默超时")}
          description={t(
            "settings.voice.wakeWord.silenceTimeoutDesc",
            "无语音输入后自动退出的时间"
          )}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[config.silenceTimeout]}
              onValueChange={([val]) => {
                actions.setConfig({ silenceTimeout: val });
                setHasChanges(true);
              }}
              min={10}
              max={120}
              step={5}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10 text-right">
              {config.silenceTimeout}s
            </span>
          </div>
        </SettingsItem>

        {/* Wake Word Test */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-col items-center py-4 gap-3">
            {/* Status icon */}
            <div className="relative">
              {wakeWordDetected ? (
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
              ) : wakeWord.state === "loading" ? (
                <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-yellow-500 animate-spin" />
                </div>
              ) : wakeWord.isListening ? (
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                  <AudioWaveform className="w-7 h-7 text-blue-500" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <AudioWaveform className="w-7 h-7 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Status text */}
            <p className="text-sm text-muted-foreground">
              {wakeWordDetected
                ? t("settings.voice.wakeWord.test.detected", "检测到唤醒词！")
                : wakeWord.state === "loading"
                  ? t("settings.voice.wakeWord.test.loading", "正在加载模型...")
                  : wakeWord.isListening
                    ? t("settings.voice.wakeWord.test.listening", { wakeWord: config.wakeWord })
                    : t("settings.voice.wakeWord.test.idle", "测试唤醒词检测")}
            </p>

            {/* Detection result */}
            {lastDetection && (
              <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded">
                {t("settings.voice.wakeWord.test.score", "置信度")}: {(lastDetection.score * 100).toFixed(1)}%
              </p>
            )}

            {/* Error message */}
            {wakeWordError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-1 rounded max-w-xs text-center">
                {wakeWordError}
              </p>
            )}

            {/* Test button */}
            <Button
              onClick={handleWakeWordTestToggle}
              disabled={wakeWord.state === "loading"}
              variant={wakeWord.isListening ? "destructive" : "outline"}
              size="sm"
            >
              {wakeWord.isListening ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  {t("settings.voice.wakeWord.test.stop", "停止测试")}
                </>
              ) : (
                <>
                  <AudioWaveform className="w-4 h-4 mr-2" />
                  {t("settings.voice.wakeWord.test.start", "测试唤醒词")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sound Effects Card */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.voice.sound.title", "音效设置")} />

        <SettingsItem
          title={t("settings.voice.sound.enabled", "启用音效")}
          description={t(
            "settings.voice.sound.enabledDesc",
            "播放唤醒和错误等操作的音效反馈"
          )}
        >
          <Switch
            checked={config.enableSoundEffects}
            onCheckedChange={(checked) => {
              actions.setConfig({ enableSoundEffects: checked });
              setHasChanges(true);
            }}
          />
        </SettingsItem>
      </div>

      {/* Test Card */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.voice.test.title", "测试语音功能")} />

        <div className="flex flex-col items-center py-6 gap-4">
          {/* Status icon */}
          <div className="relative">
            {voiceAgent.isListening ? (
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Mic className="w-8 h-8 text-red-500" />
              </div>
            ) : voiceAgent.state === "connecting" ? (
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MicOff className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Status text */}
          <p className="text-sm text-muted-foreground">
            {voiceAgent.isListening
              ? t("settings.voice.test.listening", "正在监听...")
              : voiceAgent.state === "connecting"
                ? t("settings.voice.test.connecting", "正在连接...")
                : t("settings.voice.test.idle", "点击开始说话")}
          </p>

          {/* User transcript */}
          {voiceAgent.userTranscript && (
            <p className="text-sm text-foreground bg-muted px-3 py-1 rounded">
              {voiceAgent.userTranscript}
            </p>
          )}

          {/* Test button */}
          <Button
            onClick={handleTestToggle}
            disabled={voiceAgent.state === "connecting" || !apiKey || !agentId}
            variant={voiceAgent.isConnected ? "destructive" : "default"}
          >
            {voiceAgent.isConnected ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                {t("settings.voice.test.stop", "停止")}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                {t("settings.voice.test.start", "开始测试")}
              </>
            )}
          </Button>

          {(!apiKey || !agentId) && (
            <p className="text-xs text-destructive">
              {t("settings.voice.test.noConfig", "请先配置 API Key 和 Agent ID")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
