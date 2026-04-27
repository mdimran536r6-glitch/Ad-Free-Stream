import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { bestAudio, extractVideoId, mediaProxy, pipedStream } from "@/lib/piped";

export interface NowPlaying {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  localUri?: string;
}

export interface PlayOptions {
  queue?: NowPlaying[];
  /** When true, do not navigate to the full /player screen. */
  silent?: boolean;
}

interface PlayerContextValue {
  current: NowPlaying | null;
  queue: NowPlaying[];
  queueIndex: number;
  upNext: NowPlaying[];
  history: NowPlaying[];
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  hasNext: boolean;
  hasPrevious: boolean;
  play: (track: NowPlaying, options?: PlayOptions) => Promise<void>;
  playAt: (index: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [queue, setQueue] = useState<NowPlaying[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const advanceLockRef = useRef<boolean>(false);
  const lastFinishedIdRef = useRef<string | null>(null);

  const current = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;

  // Fire and forget: load the audio for `track` into the player.
  const loadAudio = useCallback(
    async (track: NowPlaying) => {
      try {
        setIsLoading(true);
        let uri = track.localUri ?? null;
        let mime: string | undefined;
        if (!uri) {
          const details = await pipedStream(track.videoId);
          const audio = bestAudio(details.audioStreams);
          if (!audio) throw new Error("No audio stream available");
          uri = audio.url;
          mime = audio.mimeType;
        }
        player.replace({ uri: mediaProxy(uri, mime) });
        try { player.muted = false; } catch {}
        player.play();
      } catch (err) {
        console.warn("[player] load failed", err);
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  // Auto-fetch related songs and append to queue if we don't already have an
  // upcoming queue. Mimics YT Music's endless related-songs feed.
  const autoEnqueueRelated = useCallback(async (track: NowPlaying) => {
    try {
      const details = await pipedStream(track.videoId);
      const related = (details.relatedStreams ?? [])
        .filter((s) => s && s.type === "stream" && extractVideoId(s.url))
        .slice(0, 25)
        .map((s) => ({
          videoId: extractVideoId(s.url),
          title: s.title,
          artist: s.uploaderName,
          thumbnail: s.thumbnail,
        })) as NowPlaying[];
      if (related.length === 0) return;
      setQueue((q) => {
        // Drop any duplicates that are already in the queue
        const ids = new Set(q.map((t) => t.videoId));
        const fresh = related.filter((r) => !ids.has(r.videoId));
        return [...q, ...fresh];
      });
    } catch (err) {
      // Silent — related-stream fetch is best-effort.
      console.warn("[player] related fetch failed", err);
    }
  }, []);

  const play = useCallback(
    async (track: NowPlaying, options?: PlayOptions) => {
      const passedQueue = options?.queue;
      let nextQueue: NowPlaying[];
      let nextIndex: number;

      if (passedQueue && passedQueue.length > 0) {
        // De-dup the queue and find the index for `track`. If `track` isn't in
        // the passed queue, prepend it.
        const seen = new Set<string>();
        const cleaned: NowPlaying[] = [];
        for (const t of passedQueue) {
          if (!t.videoId || seen.has(t.videoId)) continue;
          seen.add(t.videoId);
          cleaned.push(t);
        }
        let idx = cleaned.findIndex((t) => t.videoId === track.videoId);
        if (idx === -1) {
          cleaned.unshift(track);
          idx = 0;
        }
        nextQueue = cleaned;
        nextIndex = idx;
      } else {
        nextQueue = [track];
        nextIndex = 0;
      }

      setQueue(nextQueue);
      setQueueIndex(nextIndex);
      lastFinishedIdRef.current = null;

      if (!options?.silent) {
        try { router.push("/player"); } catch {}
      }

      await loadAudio(track);

      // Auto-build related queue when there is nothing queued after this track.
      if (nextIndex >= nextQueue.length - 1) {
        autoEnqueueRelated(track);
      }
    },
    [loadAudio, autoEnqueueRelated],
  );

  const playAt = useCallback(
    async (index: number) => {
      if (index < 0 || index >= queue.length) return;
      setQueueIndex(index);
      lastFinishedIdRef.current = null;
      await loadAudio(queue[index]);
      // Top up the related queue if we're nearing the end
      if (index >= queue.length - 2) {
        autoEnqueueRelated(queue[index]);
      }
    },
    [queue, loadAudio, autoEnqueueRelated],
  );

  const next = useCallback(async () => {
    if (queueIndex < 0) return;
    const ni = queueIndex + 1;
    if (ni >= queue.length) return;
    setQueueIndex(ni);
    lastFinishedIdRef.current = null;
    await loadAudio(queue[ni]);
    if (ni >= queue.length - 2) {
      autoEnqueueRelated(queue[ni]);
    }
  }, [queue, queueIndex, loadAudio, autoEnqueueRelated]);

  const previous = useCallback(async () => {
    if (queueIndex <= 0) {
      // Restart current
      try { player.seekTo(0); } catch {}
      return;
    }
    // YT Music behavior: if we are >5s into the song, restart instead of going back
    if ((status.currentTime ?? 0) > 5) {
      try { player.seekTo(0); } catch {}
      return;
    }
    const pi = queueIndex - 1;
    setQueueIndex(pi);
    lastFinishedIdRef.current = null;
    await loadAudio(queue[pi]);
  }, [queue, queueIndex, loadAudio, status.currentTime, player]);

  const toggle = useCallback(() => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing, current]);

  const seek = useCallback(
    (seconds: number) => {
      try { player.seekTo(seconds); } catch {}
    },
    [player],
  );

  const stop = useCallback(() => {
    try { player.pause(); } catch {}
    setQueue([]);
    setQueueIndex(-1);
    lastFinishedIdRef.current = null;
  }, [player]);

  // Auto-advance to the next track when the current finishes.
  useEffect(() => {
    if (!status.didJustFinish) return;
    if (!current) return;
    if (lastFinishedIdRef.current === current.videoId) return;
    lastFinishedIdRef.current = current.videoId;
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    next().finally(() => {
      advanceLockRef.current = false;
    });
  }, [status.didJustFinish, current, next]);

  const upNext = useMemo(
    () => (queueIndex >= 0 ? queue.slice(queueIndex + 1) : []),
    [queue, queueIndex],
  );

  const history = useMemo(
    () => (queueIndex > 0 ? queue.slice(0, queueIndex) : []),
    [queue, queueIndex],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      queueIndex,
      upNext,
      history,
      isLoading,
      isPlaying: !!status.playing,
      position: status.currentTime ?? 0,
      duration: status.duration ?? 0,
      hasNext: queueIndex >= 0 && queueIndex < queue.length - 1,
      hasPrevious: queueIndex > 0,
      play,
      playAt,
      next,
      previous,
      toggle,
      seek,
      stop,
    }),
    [current, queue, queueIndex, upNext, history, isLoading, status.playing, status.currentTime, status.duration, play, playAt, next, previous, toggle, seek, stop],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
