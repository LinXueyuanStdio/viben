/**
 * 麦克风音量监控器
 * 使用 Web Audio API 实时采集麦克风音量电平
 */

export type AudioLevelCallback = (level: number) => void;

export class AudioLevelMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  private isRunning = false;
  private callbacks: Set<AudioLevelCallback> = new Set();

  // 音量数据缓冲
  private dataArray: Uint8Array | null = null;

  // 平滑参数
  private smoothedLevel = 0;
  private readonly smoothingFactor = 0.3; // 0-1, 越大越平滑

  /**
   * 开始监控麦克风音量
   * @returns 是否成功启动
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log("[AudioLevelMonitor] Already running");
      return true;
    }

    try {
      // 获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // 创建音频上下文
      this.audioContext = new AudioContext();

      // 创建分析器节点
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // 连接麦克风到分析器
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      // 初始化数据缓冲
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

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
    return this.smoothedLevel;
  }

  /**
   * 是否正在运行
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * 采样循环 - 使用 requestAnimationFrame 实现平滑更新
   */
  private sampleLoop = (): void => {
    if (!this.isRunning || !this.analyser || !this.dataArray) {
      return;
    }

    // 获取时域数据（波形）
    this.analyser.getByteTimeDomainData(this.dataArray);

    // 计算 RMS (Root Mean Square) 音量
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      // 将 0-255 映射到 -1 到 1
      const normalized = (this.dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // 将 RMS 映射到 0-1 范围，并应用非线性变换使小音量更明显
    // RMS 通常在 0-0.3 范围内，我们将其放大并应用平方根使小音量更敏感
    const amplified = Math.min(1, rms * 5);
    const rawLevel = Math.sqrt(amplified); // 平方根让小音量更明显

    // 平滑处理，避免音量跳动
    this.smoothedLevel =
      this.smoothedLevel * (1 - this.smoothingFactor) +
      rawLevel * this.smoothingFactor;

    // 通知所有回调
    for (const callback of this.callbacks) {
      callback(this.smoothedLevel);
    }

    // 继续循环
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

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.dataArray = null;
    this.smoothedLevel = 0;
    this.isRunning = false;
  }
}

// 单例实例
export const audioLevelMonitor = new AudioLevelMonitor();
