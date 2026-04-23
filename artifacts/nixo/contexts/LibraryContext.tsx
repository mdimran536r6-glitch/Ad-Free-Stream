import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface SavedItem {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  savedAt: number;
  kind: "audio" | "video";
}

export interface DownloadedItem {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  format: "m4a" | "mp4" | "webm";
  localUri: string;
  size: number;
  downloadedAt: number;
}

export interface WatchHistoryItem {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId?: string;
  channelName?: string;
  watchedAt: number;
}

interface LibraryContextValue {
  items: SavedItem[];
  downloads: DownloadedItem[];
  history: WatchHistoryItem[];
  isReady: boolean;
  save: (item: Omit<SavedItem, "savedAt">) => Promise<void>;
  remove: (videoId: string) => Promise<void>;
  isSaved: (videoId: string) => boolean;
  addDownload: (d: Omit<DownloadedItem, "downloadedAt">) => Promise<void>;
  removeDownload: (videoId: string, format: DownloadedItem["format"]) => Promise<void>;
  isDownloaded: (videoId: string) => boolean;
  recordWatch: (item: Omit<WatchHistoryItem, "watchedAt">) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);
const KEY = "nixo:library:v1";
const DL_KEY = "nixo:downloads:v1";
const HIST_KEY = "nixo:history:v1";

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadedItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, b, c] = await Promise.all([
          AsyncStorage.getItem(KEY),
          AsyncStorage.getItem(DL_KEY),
          AsyncStorage.getItem(HIST_KEY),
        ]);
        if (a) setItems(JSON.parse(a));
        if (b) setDownloads(JSON.parse(b));
        if (c) setHistory(JSON.parse(c));
      } catch (err) {
        console.warn("[library] load failed", err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persistSaved = useCallback(async (next: SavedItem[]) => {
    setItems(next);
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { console.warn(e); }
  }, []);

  const persistDownloads = useCallback(async (next: DownloadedItem[]) => {
    setDownloads(next);
    try { await AsyncStorage.setItem(DL_KEY, JSON.stringify(next)); } catch (e) { console.warn(e); }
  }, []);

  const persistHistory = useCallback(async (next: WatchHistoryItem[]) => {
    setHistory(next);
    try { await AsyncStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch (e) { console.warn(e); }
  }, []);

  const save = useCallback(
    async (item: Omit<SavedItem, "savedAt">) => {
      const next = [{ ...item, savedAt: Date.now() }, ...items.filter((i) => i.videoId !== item.videoId)];
      await persistSaved(next);
    },
    [items, persistSaved],
  );

  const remove = useCallback(
    async (videoId: string) => { await persistSaved(items.filter((i) => i.videoId !== videoId)); },
    [items, persistSaved],
  );

  const isSaved = useCallback((videoId: string) => items.some((i) => i.videoId === videoId), [items]);

  const addDownload = useCallback(
    async (d: Omit<DownloadedItem, "downloadedAt">) => {
      const next = [
        { ...d, downloadedAt: Date.now() },
        ...downloads.filter((x) => !(x.videoId === d.videoId && x.format === d.format)),
      ];
      await persistDownloads(next);
    },
    [downloads, persistDownloads],
  );

  const removeDownload = useCallback(
    async (videoId: string, format: DownloadedItem["format"]) => {
      await persistDownloads(downloads.filter((x) => !(x.videoId === videoId && x.format === format)));
    },
    [downloads, persistDownloads],
  );

  const isDownloaded = useCallback((videoId: string) => downloads.some((x) => x.videoId === videoId), [downloads]);

  const recordWatch = useCallback(
    async (item: Omit<WatchHistoryItem, "watchedAt">) => {
      const next = [{ ...item, watchedAt: Date.now() }, ...history.filter((h) => h.videoId !== item.videoId)].slice(0, 100);
      await persistHistory(next);
    },
    [history, persistHistory],
  );

  const clearHistory = useCallback(async () => { await persistHistory([]); }, [persistHistory]);

  const value = useMemo<LibraryContextValue>(
    () => ({ items, downloads, history, isReady, save, remove, isSaved, addDownload, removeDownload, isDownloaded, recordWatch, clearHistory }),
    [items, downloads, history, isReady, save, remove, isSaved, addDownload, removeDownload, isDownloaded, recordWatch, clearHistory],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider");
  return ctx;
}
