// apps/desktop/src/lib/voice/audio-feedback.ts

type SoundType = "wake-up" | "error";

const SOUND_PATHS: Record<SoundType, string> = {
  "wake-up": "/assets/audio/wake-up.ogg",
  error: "/assets/audio/error.ogg",
};

const audioCache: Map<SoundType, HTMLAudioElement> = new Map();

/** 预加载音效 */
export async function preloadSounds(): Promise<void> {
  const loadSound = async (type: SoundType): Promise<void> => {
    const audio = new Audio(SOUND_PATHS[type]);
    audio.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error(`Failed to load sound: ${type}`));
    });
    audioCache.set(type, audio);
  };

  await Promise.all([loadSound("wake-up"), loadSound("error")]);
}

/** 播放音效 */
export function playSound(type: SoundType): void {
  const audio = audioCache.get(type);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(console.error);
  } else {
    // 未预加载时直接创建
    const newAudio = new Audio(SOUND_PATHS[type]);
    newAudio.play().catch(console.error);
  }
}

/** 检查是否已预加载 */
export function isSoundLoaded(type: SoundType): boolean {
  return audioCache.has(type);
}
