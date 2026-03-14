import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

interface AudioPlayerState {
  currentUrl: string | null;
  currentName: string | null;
  isPlaying: boolean;
  isLooping: boolean;
}

interface AudioPlayerContextValue {
  state: AudioPlayerState;
  play: (audioUrl: string, options?: { loop?: boolean; name?: string }) => void;
  stop: () => void;
  toggle: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    currentUrl: null,
    currentName: null,
    isPlaying: false,
    isLooping: false,
  });

  // Initialize audio element on first render
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.addEventListener('ended', () => {
      setState((s) => ({ ...s, isPlaying: false }));
    });
    audioRef.current.addEventListener('pause', () => {
      setState((s) => ({ ...s, isPlaying: false }));
    });
    audioRef.current.addEventListener('play', () => {
      setState((s) => ({ ...s, isPlaying: true }));
    });
  }

  const play = useCallback((audioUrl: string, options?: { loop?: boolean; name?: string }) => {
    const audio = audioRef.current;
    if (!audio) return;

    const loop = options?.loop ?? false;
    const name = options?.name ?? audioUrl.split('/').pop() ?? 'Unknown';

    // Stop current if playing
    audio.pause();
    audio.currentTime = 0;

    // Set new source and play
    audio.src = audioUrl;
    audio.loop = loop;
    audio.play().catch((err) => {
      console.warn('Audio playback failed:', err);
    });

    setState({
      currentUrl: audioUrl,
      currentName: name,
      isPlaying: true,
      isLooping: loop,
    });
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    setState({
      currentUrl: null,
      currentName: null,
      isPlaying: false,
      isLooping: false,
    });
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch((err) => {
        console.warn('Audio playback failed:', err);
      });
    } else {
      audio.pause();
    }
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ state, play, stop, toggle }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}

// Safe hook that doesn't throw if provider is missing (for optional usage)
export function useAudioPlayerOptional(): AudioPlayerContextValue | null {
  return useContext(AudioPlayerContext);
}
