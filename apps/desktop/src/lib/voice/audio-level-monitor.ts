/**
 * 音量监控器
 * 使用 Web Audio API 实时采集麦克风和系统音频电平
 */

export type AudioLevelCallback = (level: number) => void;

export class AudioLevelMonitor {
  private audioContext: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private systemSourceNode: MediaElementAudioSourceNode | null = null;
  private rafId: number | null = null;
  private isRunning = false;
  private callbacks: Set<AudioLevelCallback> = new Set();

  // 音量数据缓冲
  private micDataArray: Uint8Array | null = null;
  private systemDataArray: Uint8Array | null = null;

  // 平滑参数
  private smoothedMicLevel = 0;
  private smoothedSystemLevel = 0;
  private readonly smoothingFactor = 0.3;

  // 系统音频元素引用
  private audioElement: HTMLAudioElement | null = null;

  /**
   * 开始监控音量
   * @returns 是否成功启动
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("[AudioLevelMonitor] Already running");
      return true;
    }

    try {
      // 创建音频上下文
      this.audioContext = new AudioContext();

      // 1. 设置麦克风监控
      await this.setupMicrophoneMonitor();

      // 2. 设置系统音频监控（通过页面上的 audio 元素）
      this.setupSystemAudioMonitor();

      // 开始采样循环
      this.isRunning = true;
      this.sampleLoop();

      console.log("[AudioLevelMonitor] Started successfully");
      return true;
    } catch (err) {
      console.error("[AudioLevelMonitor] Failed to start:", err);
      this.cleanup();
      return false;
    }
  }

  /**
   * 设置麦克风监控
   */
  private async setupMicrophoneMonitor(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.micAnalyser = this.audioContext!.createAnalyser();
    this.micAnalyser.fftSize = 256;
    this.micAnalyser.smoothingTimeConstant = 0.8;

    this.micSourceNode = this.audioContext!.createMediaStreamSource(this.micStream);
    this.micSourceNode.connect(this.micAnalyser);

    this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
  }

  /**
   * 设置系统音频监控
   * 查找页面上的 audio 元素并监控其输出
   */
  private setupSystemAudioMonitor(): void {
    // 查找 VocalBridge 使用的 audio 元素
    // 通常是页面上的第一个 audio 元素，或者我们可以通过 ID 查找
    const audioElements = document.querySelectorAll("audio");

    if (audioElements.length > 0) {
      this.audioElement = audioElements[0] as HTMLAudioElement;
      this.connectAudioElement(this.audioElement);
    }

    // 使用 MutationObserver 监听新的 audio 元素
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAudioElement && !this.audioElement) {
            this.audioElement = node;
            this.connectAudioElement(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 连接 audio 元素到分析器
   */
  private connectAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || this.systemSourceNode) return;

    try {
      this.systemAnalyser = this.audioContext.createAnalyser();
      this.systemAnalyser.fftSize = 256;
      this.systemAnalyser.smoothingTimeConstant = 0.8;

      this.systemSourceNode = this.audioContext.createMediaElementSource(audioElement);
      this.systemSourceNode.connect(this.systemAnalyser);
      // 同时连接到输出，否则听不到声音
      this.systemSourceNode.connect(this.audioContext.destination);

      this.systemDataArray = new Uint8Array(this.systemAnalyser.frequencyBinCount);
      console.log("[AudioLevelMonitor] Connected to audio element for system audio monitoring");
    } catch (err) {
      console.warn("[AudioLevelMonitor] Failed to connect audio element:", err);
    }
  }

  /**
   * 手动连接 audio 元素（供外部调用）
   */
  connectAudio(audioElement: HTMLAudioElement): void {
    if (this.audioElement === audioElement) return;
    this.audioElement = audioElement;
    this.connectAudioElement(audioElement);
  }

  /**
   * 停止监控
   */
  stop(): void {
    console.log("[AudioLevelMonitor] Stopping...");
    this.isRunning = false;
    this.cleanup();
  }

  /**
   * 注册音量变化回调
   */
  onLevelChange(callback: AudioLevelCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 获取当前音量级别 (0-1)
   */
  getCurrentLevel(): number {
    return Math.max(this.smoothedMicLevel, this.smoothedSystemLevel);
  }

  /**
   * 是否正在运行
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * 计算 RMS 音量
   */
  private calculateRMS(dataArray: Uint8Array): number {
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / dataArray.length);
  }

  /**
   * 采样循环
   */
  private sampleLoop = (): void => {
    if (!this.isRunning) return;

    // 麦克风音量
    if (this.micAnalyser && this.micDataArray) {
      this.micAnalyser.getByteTimeDomainData(this.micDataArray);
      const micRms = this.calculateRMS(this.micDataArray);
      const micAmplified = Math.min(1, micRms * 5);
      const micRawLevel = Math.sqrt(micAmplified);
      this.smoothedMicLevel =
        this.smoothedMicLevel * (1 - this.smoothingFactor) +
        micRawLevel * this.smoothingFactor;
    }

    // 系统音量
    if (this.systemAnalyser && this.systemDataArray) {
      this.systemAnalyser.getByteTimeDomainData(this.systemDataArray);
      const systemRms = this.calculateRMS(this.systemDataArray);
      const systemAmplified = Math.min(1, systemRms * 5);
      const systemRawLevel = Math.sqrt(systemAmplified);
      this.smoothedSystemLevel =
        this.smoothedSystemLevel * (1 - this.smoothingFactor) +
        systemRawLevel * this.smoothingFactor;
    }

    // 取麦克风和系统音量的较大值
    const combinedLevel = Math.max(this.smoothedMicLevel, this.smoothedSystemLevel);

    // 通知回调
    for (const callback of this.callbacks) {
      callback(combinedLevel);
    }

    // 调试日志
    if (Math.random() < 0.02 && combinedLevel > 0.01) {
      console.log(
        "[AudioLevelMonitor] mic:",
        this.smoothedMicLevel.toFixed(3),
        "sys:",
        this.smoothedSystemLevel.toFixed(3),
        "combined:",
        combinedLevel.toFixed(3)
      );
    }

    this.rafId = requestAnimationFrame(this.sampleLoop);
  };

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect();
      this.systemSourceNode = null;
    }

    if (this.micAnalyser) {
      this.micAnalyser.disconnect();
      this.micAnalyser = null;
    }

    if (this.systemAnalyser) {
      this.systemAnalyser.disconnect();
      this.systemAnalyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    this.micDataArray = null;
    this.systemDataArray = null;
    this.audioElement = null;
    this.smoothedMicLevel = 0;
    this.smoothedSystemLevel = 0;
    this.isRunning = false;
  }
}

// 单例实例
export const audioLevelMonitor = new AudioLevelMonitor();
