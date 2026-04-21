// apps/desktop/src/hooks/use-shared-audio.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { sharedAudioStream } from '@/lib/voice/shared-audio-stream';

type AudioFrameCallback = (audioData: Float32Array) => void;

interface UseSharedAudioReturn {
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  subscribe: (callback: AudioFrameCallback) => () => void;
  getMediaStream: () => MediaStream | null;
}

/**
 * 共享音频流 Hook
 * 管理麦克风访问，支持多个消费者（唤醒词检测、Vocal Bridge）
 */
export function useSharedAudio(): UseSharedAudioReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // 同步初始状态
    setIsInitialized(sharedAudioStream.initialized);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initialize = useCallback(async () => {
    if (sharedAudioStream.initialized || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      await sharedAudioStream.initialize();
      if (mountedRef.current) {
        setIsInitialized(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [isInitializing]);

  const destroy = useCallback(async () => {
    await sharedAudioStream.destroy();
    if (mountedRef.current) {
      setIsInitialized(false);
    }
  }, []);

  const subscribe = useCallback((callback: AudioFrameCallback) => {
    return sharedAudioStream.subscribe(callback);
  }, []);

  const getMediaStream = useCallback(() => {
    return sharedAudioStream.getMediaStream();
  }, []);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    destroy,
    subscribe,
    getMediaStream,
  };
}
