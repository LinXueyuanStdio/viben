// apps/desktop/src/lib/voice/vocal-bridge-client.ts

export interface VocalBridgeConfig {
  apiKey: string;
  agentId?: string;
  tokenUrl?: string;
}

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

/**
 * Vocal Bridge SDK 封装
 * 注：实际 SDK 可能尚未发布，此为基于文档的实现
 * 后续需要根据实际 SDK API 进行调整
 */
export class VocalBridgeClient {
  private config: VocalBridgeConfig | null = null;
  private state: VocalBridgeState = 'disconnected';
  private transcript: TranscriptEvent[] = [];

  private stateCallbacks: Set<StateCallback> = new Set();
  private transcriptCallbacks: Set<TranscriptCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();

  // WebRTC 相关
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;

  /** 配置客户端 */
  configure(config: VocalBridgeConfig): void {
    this.config = config;
  }

  /** 连接到 Voice Agent */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set. Call configure() first.');
    }

    this.setState('connecting');
    this.transcript = [];

    try {
      // 获取麦克风权限
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // 创建 WebRTC 连接
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // 添加音频轨道
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 创建数据通道用于文本消息
      this.dataChannel = this.peerConnection.createDataChannel('transcript');
      this.setupDataChannel();

      // 监听远程音频
      this.peerConnection.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(console.error);
      };

      // ICE 连接状态
      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection?.iceConnectionState;
        if (iceState === 'connected') {
          this.setState('connected');
        } else if (iceState === 'disconnected' || iceState === 'failed') {
          this.setState('disconnected');
        }
      };

      // 注：实际连接需要与 Vocal Bridge 服务器进行信令交换
      // 这里仅为框架实现，需要根据实际 API 完善
      this.setState('waiting_for_agent');

      // 模拟连接成功（实际需要信令服务器）
      setTimeout(() => {
        if (this.state === 'waiting_for_agent') {
          this.setState('connected');
        }
      }, 1000);
    } catch (err) {
      this.setState('error');
      this.notifyError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          const transcriptEvent: TranscriptEvent = {
            role: data.role,
            text: data.text,
            timestamp: Date.now(),
          };
          this.transcript.push(transcriptEvent);
          this.notifyTranscript(transcriptEvent);
        }
      } catch (err) {
        console.error('[VocalBridgeClient] Failed to parse message:', err);
      }
    };

    this.dataChannel.onerror = (event) => {
      console.error('[VocalBridgeClient] DataChannel error:', event);
      this.notifyError(new Error('DataChannel error'));
    };
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.setState('disconnected');
  }

  /** 静音/取消静音 */
  async toggleMicrophone(): Promise<void> {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  }

  /** 设置麦克风状态 */
  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
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

  private setState(state: VocalBridgeState): void {
    if (this.state === state) return;
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
}

export const vocalBridgeClient = new VocalBridgeClient();
