import type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig } from './speech-types.js';

/**
 * A factory that recreates provider instances from a new config snapshot.
 * Used for hot-reload: when settings change, the plugin calls `refreshProviders`
 * which invokes this factory to build fresh provider objects.
 *
 * Returns separate Maps for STT and TTS so that externally-registered providers
 * (e.g. from `@viben/msedge-tts-plugin`) are not discarded — only factory-owned
 * providers are overwritten.
 */
export type ProviderFactory = (config: SpeechServiceConfig) => { stt: Map<string, STTProvider>; tts: Map<string, TTSProvider> };

/**
 * Central service for speech-to-text and text-to-speech operations.
 *
 * Providers are registered at setup time and may also be registered by external
 * plugins (e.g. `@viben/msedge-tts-plugin` registers a TTS provider after boot).
 * The service itself is registered under the `"speech"` key in the ServiceRegistry
 * and accessed by `session.ts` to synthesize audio after agent responses when
 * `voiceMode` is active.
 */
export class SpeechService {
  private sttProviders = new Map<string, STTProvider>();
  private ttsProviders = new Map<string, TTSProvider>();
  private providerFactory?: ProviderFactory;

  constructor(private config: SpeechServiceConfig) {}

  /** Set a factory function that can recreate providers from config (for hot-reload) */
  setProviderFactory(factory: ProviderFactory): void {
    this.providerFactory = factory;
  }

  /** Register an STT provider by name. Overwrites any existing provider with the same name. */
  registerSTTProvider(name: string, provider: STTProvider): void {
    this.sttProviders.set(name, provider);
  }

  /** Register a TTS provider by name. Called by external TTS plugins (e.g. msedge-tts-plugin). */
  registerTTSProvider(name: string, provider: TTSProvider): void {
    this.ttsProviders.set(name, provider);
  }

  /** Remove a TTS provider — called by external plugins on teardown. */
  unregisterTTSProvider(name: string): void {
    this.ttsProviders.delete(name);
  }

  /** Returns true if an STT provider is configured and has credentials. */
  isSTTAvailable(): boolean {
    const { provider, providers } = this.config.stt;
    return provider !== null && providers[provider]?.apiKey !== undefined;
  }

  /**
   * Returns true if a TTS provider is configured and an implementation is registered.
   *
   * Config alone is not enough — the TTS provider plugin must have registered
   * its implementation via `registerTTSProvider` before this returns true.
   */
  isTTSAvailable(): boolean {
    const provider = this.config.tts.provider;
    return provider !== null && this.ttsProviders.has(provider);
  }

  /**
   * Transcribes audio using the configured STT provider.
   *
   * @throws if no STT provider is configured or if the named provider is not registered.
   */
  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const providerName = this.config.stt.provider;
    if (!providerName || !this.config.stt.providers[providerName]?.apiKey) {
      throw new Error("STT not configured. Set speech.stt.provider and API key in config.");
    }
    const provider = this.sttProviders.get(providerName);
    if (!provider) {
      throw new Error(`STT provider "${providerName}" not registered. Available: ${[...this.sttProviders.keys()].join(", ") || "none"}`);
    }
    return provider.transcribe(audioBuffer, mimeType, options);
  }

  /**
   * Synthesizes speech using the configured TTS provider.
   *
   * @throws if no TTS provider is configured or if the named provider is not registered.
   */
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const providerName = this.config.tts.provider;
    if (!providerName) {
      throw new Error("TTS not configured. Set speech.tts.provider in config.");
    }
    const provider = this.ttsProviders.get(providerName);
    if (!provider) {
      throw new Error(`TTS provider "${providerName}" not registered. Available: ${[...this.ttsProviders.keys()].join(", ") || "none"}`);
    }
    return provider.synthesize(text, options);
  }

  /** Replace the active config without rebuilding providers. Use `refreshProviders` to also rebuild. */
  updateConfig(config: SpeechServiceConfig): void {
    this.config = config;
  }

  /**
   * Reloads TTS and STT providers from a new config snapshot.
   *
   * Called after config changes or plugin hot-reload. Factory-managed providers are
   * rebuilt via the registered `ProviderFactory`; externally-registered providers
   * (e.g. from `@viben/msedge-tts-plugin`) are preserved rather than discarded.
   */
  refreshProviders(newConfig: SpeechServiceConfig): void {
    this.config = newConfig;
    if (this.providerFactory) {
      const { stt, tts } = this.providerFactory(newConfig);
      // Merge: factory providers overwrite, but externally-registered providers are preserved
      for (const [name, provider] of stt) {
        this.sttProviders.set(name, provider);
      }
      for (const [name, provider] of tts) {
        this.ttsProviders.set(name, provider);
      }
    }
  }
}
