import type { STTProvider, STTOptions, STTResult } from '../speech-types.js';

// Groq's Whisper-compatible transcription endpoint (OpenAI-compatible API)
const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Speech-to-text provider backed by Groq's hosted Whisper API.
 *
 * Groq requires the audio to be submitted as a multipart form upload. The file
 * must have a valid extension matching its MIME type — Groq uses the extension
 * to determine the codec, so a mismatch causes a transcription error.
 *
 * Free tier limit: 28,800 seconds of audio per day. Max file size: 25 MB.
 */
export class GroqSTT implements STTProvider {
  readonly name = "groq";

  constructor(
    private apiKey: string,
    private defaultModel: string = "whisper-large-v3-turbo",
  ) {}

  /**
   * Transcribes audio using the Groq Whisper API.
   *
   * `verbose_json` response format is requested so the API returns language
   * detection and duration metadata alongside the transcript text.
   */
  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const ext = mimeToExt(mimeType);
    const form = new FormData();
    // Groq uses the filename extension to identify the audio codec — must match mimeType
    form.append("file", new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), `audio${ext}`);
    form.append("model", options?.model || this.defaultModel);
    form.append("response_format", "verbose_json");
    if (options?.language) {
      form.append("language", options.language);
    }

    const resp = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 401) {
        throw new Error("Invalid Groq API key. Check your key at console.groq.com.");
      }
      if (resp.status === 413) {
        throw new Error("Audio file too large for Groq API (max 25MB).");
      }
      if (resp.status === 429) {
        throw new Error("Groq rate limit exceeded. Free tier: 28,800 seconds/day. Try again later.");
      }
      throw new Error(`Groq STT error (${resp.status}): ${body}`);
    }

    const data = await resp.json() as { text: string; language?: string; duration?: number };
    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
    };
  }
}

/** Maps MIME types to file extensions required by the Groq upload API. */
function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "audio/flac": ".flac",
  };
  return map[mimeType] || ".bin";
}
