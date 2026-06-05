/** Options passed to an STT provider for a single transcription request. */
export interface STTOptions {
  /** BCP-47 language code hint (e.g. `"en"`, `"vi"`). Improves accuracy when known. */
  language?: string;
  /** Override the default model for this request. */
  model?: string;
}

/** Result returned by an STT provider after transcription. */
export interface STTResult {
  text: string;
  /** Detected or confirmed language (BCP-47). */
  language?: string;
  /** Audio duration in seconds. */
  duration?: number;
}

/** Options passed to a TTS provider for a single synthesis request. */
export interface TTSOptions {
  language?: string;
  /** Voice identifier (provider-specific, e.g. `"en-US-AriaNeural"` for Edge TTS). */
  voice?: string;
  model?: string;
}

/** Audio data produced by a TTS provider. */
export interface TTSResult {
  audioBuffer: Buffer;
  /** MIME type of the audio (e.g. `"audio/mp3"`, `"audio/wav"`). */
  mimeType: string;
}

/** Contract for a speech-to-text provider. */
export interface STTProvider {
  readonly name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>;
}

/** Contract for a text-to-speech provider. */
export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

/** Provider-level configuration stored in plugin settings (API key, model override, etc.). */
export interface SpeechProviderConfig {
  apiKey?: string;
  model?: string;
  [key: string]: unknown;
}

/**
 * Top-level configuration for SpeechService.
 *
 * `stt.provider` and `tts.provider` name the active provider.
 * `null` disables the respective capability.
 * `providers` holds per-provider credentials and options.
 */
export interface SpeechServiceConfig {
  stt: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
  };
  tts: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
  };
}
