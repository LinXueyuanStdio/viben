import * as ort from 'onnxruntime-web';

export interface WakeWordDetection {
  keyword: string;
  score: number;
  timestamp: number;
}

export type WakeWordCallback = (detection: WakeWordDetection) => void;

const BASE_MODELS_PATH = '/openwakeword/models';

/**
 * openWakeWord 引擎封装
 * 基于 onnxruntime-web 运行 ONNX 模型
 */
export class WakeWordEngine {
  private melSession: ort.InferenceSession | null = null;
  private embeddingSession: ort.InferenceSession | null = null;
  private vadSession: ort.InferenceSession | null = null;
  private keywordSessions: Map<string, ort.InferenceSession> = new Map();

  private activeKeywords: Set<string> = new Set();
  private callbacks: Set<WakeWordCallback> = new Set();
  private isLoaded = false;

  private melBuffer: Float32Array[] = [];
  private embeddingBuffer: Float32Array[] = [];

  /** 加载基础模型 */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    // 配置 ONNX Runtime 使用 WASM
    ort.env.wasm.wasmPaths = '/openwakeword/ort/';

    // 加载基础模型
    this.melSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/melspectrogram.onnx`
    );
    this.embeddingSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/embedding_model.onnx`
    );
    this.vadSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/silero_vad.onnx`
    );

    this.isLoaded = true;
  }

  /** 加载唤醒词模型 */
  async loadKeyword(name: string, modelPath?: string): Promise<void> {
    if (!this.isLoaded) {
      throw new Error('Base models not loaded. Call load() first.');
    }

    const path = modelPath ?? `${BASE_MODELS_PATH}/${name}.onnx`;
    const session = await ort.InferenceSession.create(path);
    this.keywordSessions.set(name, session);
  }

  /** 设置激活的唤醒词 */
  setActiveKeywords(keywords: string[]): void {
    this.activeKeywords = new Set(keywords);
  }

  /** 处理音频帧 (80ms @ 16kHz = 1280 samples) */
  async processFrame(audioData: Float32Array, threshold = 0.5): Promise<void> {
    if (!this.isLoaded || !this.melSession || !this.embeddingSession) return;

    // 1. 计算 Mel 频谱图
    const melTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);
    const melResult = await this.melSession.run({ audio: melTensor });
    const melOutput = melResult.output as ort.Tensor;

    this.melBuffer.push(new Float32Array(melOutput.data as Float32Array));
    if (this.melBuffer.length > 76) this.melBuffer.shift(); // 保持窗口大小

    if (this.melBuffer.length < 76) return; // 需要足够的上下文

    // 2. 计算嵌入向量
    const melInput = this.concatenateMelFrames();
    const embTensor = new ort.Tensor('float32', melInput, [1, 76, 32]);
    const embResult = await this.embeddingSession.run({ input: embTensor });
    const embOutput = embResult.output as ort.Tensor;

    this.embeddingBuffer.push(new Float32Array(embOutput.data as Float32Array));
    if (this.embeddingBuffer.length > 16) this.embeddingBuffer.shift();

    if (this.embeddingBuffer.length < 16) return;

    // 3. 对每个激活的唤醒词运行检测
    const embInput = this.concatenateEmbeddings();

    for (const keyword of this.activeKeywords) {
      const session = this.keywordSessions.get(keyword);
      if (!session) continue;

      const kwTensor = new ort.Tensor('float32', embInput, [1, 16, 96]);
      const kwResult = await session.run({ input: kwTensor });
      const score = (kwResult.output as ort.Tensor).data[0] as number;

      if (score >= threshold) {
        const detection: WakeWordDetection = {
          keyword,
          score,
          timestamp: Date.now(),
        };
        this.notifyCallbacks(detection);
      }
    }
  }

  private concatenateMelFrames(): Float32Array {
    const totalLength = this.melBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of this.melBuffer) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  private concatenateEmbeddings(): Float32Array {
    const totalLength = this.embeddingBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of this.embeddingBuffer) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /** 订阅唤醒词检测事件 */
  onDetection(callback: WakeWordCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(detection: WakeWordDetection): void {
    for (const callback of this.callbacks) {
      callback(detection);
    }
  }

  /** 销毁引擎 */
  async destroy(): Promise<void> {
    for (const session of this.keywordSessions.values()) {
      await session.release();
    }
    this.keywordSessions.clear();

    if (this.melSession) await this.melSession.release();
    if (this.embeddingSession) await this.embeddingSession.release();
    if (this.vadSession) await this.vadSession.release();

    this.melSession = null;
    this.embeddingSession = null;
    this.vadSession = null;
    this.isLoaded = false;
    this.callbacks.clear();
  }

  get loaded(): boolean {
    return this.isLoaded;
  }
}

export const wakeWordEngine = new WakeWordEngine();
