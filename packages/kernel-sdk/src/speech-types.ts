// Speech provider types for use by Viben plugins.
// These are stable interfaces that plugins can rely on without depending
// on @viben/kernel internals.

export interface TTSOptions {
  language?: string;
  voice?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
}

export interface STTOptions {
  language?: string;
  model?: string;
}

export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>;
}

export interface SpeechServiceInterface {
  registerTTSProvider(name: string, provider: TTSProvider): void;
  unregisterTTSProvider(name: string): void;
  registerSTTProvider(name: string, provider: STTProvider): void;
  unregisterSTTProvider?(name: string): void;
  isTTSAvailable(): boolean;
  isSTTAvailable(): boolean;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>;
}
