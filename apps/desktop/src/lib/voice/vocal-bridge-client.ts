// apps/desktop/src/lib/voice/vocal-bridge-client.ts
import { VocalBridge } from '@vocalbridgeai/sdk';
import { getClient } from '@/lib/viben';

export interface TranscriptEvent {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export type VocalBridgeState =
  | 'disconnected'
  | 'connecting'
  | 'waiting_for_agent'
  | 'connected'
  | 'error';

type StateCallback = (state: VocalBridgeState) => void;
type TranscriptCallback = (event: TranscriptEvent) => void;
type ErrorCallback = (error: Error) => void;
type AudioLevelCallback = (level: number) => void;

/**
 * Vocal Bridge SDK 封装
 * 使用官方 @vocalbridgeai/sdk，通过 api-client 获取 token
 */
export class VocalBridgeClient {
  private apiKey: string | null = null;
  private agentId: string | null = null;
  private state: VocalBridgeState = 'disconnected';
  private transcript: TranscriptEvent[] = [];

  private stateCallbacks: Set<StateCallback> = new Set();
  private transcriptCallbacks: Set<TranscriptCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private audioLevelCallbacks: Set<AudioLevelCallback> = new Set();

  // Vocal Bridge SDK 实例
  private vb: VocalBridge | null = null;

  /** 配置客户端 */
  configure(apiKey: string, agentId: string): void {
    this.apiKey = apiKey;
    this.agentId = agentId;
  }

  /**
   * 自定义 token provider
   * 通过 api-client 获取 token，绕过 CORS
   */
  private createTokenProvider() {
    const apiKey = this.apiKey!;
    const agentId = this.agentId!;

    return async () => {
      console.log('[VocalBridgeClient] Fetching token via api-client...');

      const client = getClient();
      const data = await client.voice.getToken({
        api_key: apiKey,
        agent_id: agentId,
        participant_name: 'Viben User',
      });

      console.log('[VocalBridgeClient] Token received:', {
        room_name: data.room_name,
        livekit_url: data.livekit_url,
      });

      // SDK 期望的字段名是 url，但 API 返回 livekit_url
      // 返回完整的 TokenResponse 对象
      return {
        url: data.livekit_url,
        token: data.token,
        room_name: data.room_name,
        participant_identity: data.participant_identity,
        expires_in: data.expires_in,
        agent_mode: data.agent_mode,
      };
    };
  }

  /** 连接到 Voice Agent */
  async connect(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('API Key not configured. Call configure() first.');
    }

    if (!this.agentId) {
      throw new Error('Agent ID not configured. Call configure() first.');
    }

    this.setState('connecting');
    this.transcript = [];

    try {
      console.log('[VocalBridgeClient] Creating VocalBridge instance...');
      console.log('[VocalBridgeClient] Agent ID:', this.agentId);

      // 使用 tokenProvider 模式，通过 api-client 获取 token
      this.vb = new VocalBridge({
        auth: {
          tokenProvider: this.createTokenProvider(),
        },
        participantName: 'Viben User',
        debug: true,
      });

      // 监听连接状态变化
      this.vb.on('connectionStateChanged', (state: string) => {
        console.log('[VocalBridgeClient] Connection state:', state);
        switch (state) {
          case 'connecting':
            this.setState('connecting');
            break;
          case 'waiting_for_agent':
            this.setState('waiting_for_agent');
            break;
          case 'connected':
            this.setState('connected');
            break;
          case 'disconnected':
            this.setState('disconnected');
            break;
        }
      });

      // 监听 transcript 事件
      this.vb.on('transcript', ({ role, text }: { role: 'user' | 'agent'; text: string }) => {
        console.log(`[VocalBridgeClient] Transcript [${role}]:`, text);
        const event: TranscriptEvent = {
          role,
          text,
          timestamp: Date.now(),
        };
        this.transcript.push(event);
        this.notifyTranscript(event);
      });

      // 监听错误
      this.vb.on('error', (error: Error) => {
        console.error('[VocalBridgeClient] Error:', error);
        this.setState('error');
        this.notifyError(error);
      });

      // 监听音频级别（如果 SDK 支持）
      // @ts-expect-error - audioLevel event may not be in type definitions
      this.vb.on('audioLevel', (level: number) => {
        this.notifyAudioLevel(level);
      });

      // 监听用户说话状态变化
      // @ts-expect-error - userSpeakingChanged event may not be in type definitions
      this.vb.on('userSpeakingChanged', (isSpeaking: boolean) => {
        // 用户说话时提高音量指示
        this.notifyAudioLevel(isSpeaking ? 0.7 : 0);
      });

      // 开始连接
      console.log('[VocalBridgeClient] Connecting...');
      await this.vb.connect();

      console.log('[VocalBridgeClient] Connected successfully');
    } catch (err) {
      console.error('[VocalBridgeClient] Connection error:', err);
      this.setState('error');
      const error = err instanceof Error ? err : new Error(String(err));
      this.notifyError(error);
      throw error;
    }
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.vb) {
      console.log('[VocalBridgeClient] Disconnecting...');
      await this.vb.disconnect();
      this.vb = null;
    }
    this.setState('disconnected');
  }

  /** 静音/取消静音 */
  async toggleMicrophone(): Promise<void> {
    if (this.vb) {
      await this.vb.toggleMicrophone();
    }
  }

  /** 设置麦克风状态 */
  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (this.vb) {
      await this.vb.setMicrophoneEnabled(enabled);
    }
  }

  /** 获取当前状态 */
  getState(): VocalBridgeState {
    return this.state;
  }

  /** 获取对话历史 */
  getTranscript(): TranscriptEvent[] {
    return [...this.transcript];
  }

  /** 清除对话历史 */
  clearTranscript(): void {
    this.transcript = [];
    if (this.vb) {
      this.vb.clearTranscript();
    }
  }

  /** 订阅状态变化 */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /** 订阅转写文本 */
  onTranscript(callback: TranscriptCallback): () => void {
    this.transcriptCallbacks.add(callback);
    return () => this.transcriptCallbacks.delete(callback);
  }

  /** 订阅错误 */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /** 订阅音频级别变化 */
  onAudioLevel(callback: AudioLevelCallback): () => void {
    this.audioLevelCallbacks.add(callback);
    return () => this.audioLevelCallbacks.delete(callback);
  }

  private setState(state: VocalBridgeState): void {
    if (this.state === state) return;
    console.log('[VocalBridgeClient] State:', this.state, '->', state);
    this.state = state;
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }

  private notifyTranscript(event: TranscriptEvent): void {
    for (const callback of this.transcriptCallbacks) {
      callback(event);
    }
  }

  private notifyError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }

  private notifyAudioLevel(level: number): void {
    for (const callback of this.audioLevelCallbacks) {
      callback(level);
    }
  }
}

export const vocalBridgeClient = new VocalBridgeClient();
