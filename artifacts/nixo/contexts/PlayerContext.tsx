import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { bestAudio, mediaProxy, pipedStream } from "@/lib/piped";

export interface NowPlaying {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  localUri?: string;
}

interface PlayerContextValue {
  current: NowPlaying | null;
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  play: (track: NowPlaying) => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const play = useCallback(
    async (track: NowPlaying) => {
      try {
        setIsLoading(true);
        setCurrent(track);
        let uri = track.localUri ?? null;
        if (!uri) {
          const details = await pipedStream(track.videoId);
          const audio = bestAudio(details.audioStreams);
          if (!audio) throw new Error("No audio stream available");
          uri = audio.url;
        }
        player.replace({ uri: mediaProxy(uri) });
        player.play();
      } catch (err) {
        console.warn("[player] play failed", err);
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing, current]);

  const seek = useCallback(
    (seconds: number) => {
      player.seekTo(seconds);
    },
    [player],
  );

  const stop = useCallback(() => {
    player.pause();
    setCurrent(null);
  }, [player]);

  // Auto-advance: nothing for now (single track)
  useEffect(() => {
    if (status.didJustFinish) {
      // keep current visible but paused
    }
  }, [status.didJustFinish]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isLoading,
      isPlaying: !!status.playing,
      position: status.currentTime ?? 0,
      duration: status.duration ?? 0,
      play,
      toggle,
      seek,
      stop,
    }),
    [current, isLoading, status.playing, status.currentTime, status.duration, play, toggle, seek, stop],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
