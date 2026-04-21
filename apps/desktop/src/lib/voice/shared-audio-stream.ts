// apps/desktop/src/lib/voice/shared-audio-stream.ts

type AudioFrameCallback = (audioData: Float32Array) => void;

/**
 * 共享音频流管理器 (单例)
 * 统一管理麦克风访问，支持多个消费者
 */
class SharedAudioStream {
  private static instance: SharedAudioStream | null = null;

  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private frameCallbacks: Set<AudioFrameCallback> = new Set();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): SharedAudioStream {
    if (!SharedAudioStream.instance) {
      SharedAudioStream.instance = new SharedAudioStream();
    }
    return SharedAudioStream.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // 80ms 帧 @ 16kHz = 1280 samples
    this.processorNode = this.audioContext.createScriptProcessor(1280, 1, 1);
    this.processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputData);

      for (const callback of this.frameCallbacks) {
        callback(audioData);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    this.isInitialized = true;
  }

  /** 获取原始 MediaStream (用于 WebRTC) */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /** 订阅音频帧 (用于唤醒词检测) */
  subscribe(callback: AudioFrameCallback): () => void {
    this.frameCallbacks.add(callback);
    return () => this.frameCallbacks.delete(callback);
  }

  async destroy(): Promise<void> {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.frameCallbacks.clear();
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export const sharedAudioStream = SharedAudioStream.getInstance();
