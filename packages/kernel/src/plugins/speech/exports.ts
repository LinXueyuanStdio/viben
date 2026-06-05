// Public surface of the speech plugin — re-exported for use by the plugin index
// and by external TTS plugins that need to register against SpeechService.
export type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig, SpeechProviderConfig } from './speech-types.js';
export { SpeechService } from './speech-service.js';
export { GroqSTT } from './providers/groq.js';
