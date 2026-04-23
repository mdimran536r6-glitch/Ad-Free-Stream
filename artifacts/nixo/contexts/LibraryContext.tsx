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

interface LibraryContextValue {
  items: SavedItem[];
  isReady: boolean;
  save: (item: Omit<SavedItem, "savedAt">) => Promise<void>;
  remove: (videoId: string) => Promise<void>;
  isSaved: (videoId: string) => boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);
const KEY = "nixo:library:v1";

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setItems(JSON.parse(raw) as SavedItem[]);
      } catch (err) {
        console.warn("[library] load failed", err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: SavedItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("[library] save failed", err);
    }
  }, []);

  const save = useCallback(
    async (item: Omit<SavedItem, "savedAt">) => {
      const next = [{ ...item, savedAt: Date.now() }, ...items.filter((i) => i.videoId !== item.videoId)];
      await persist(next);
    },
    [items, persist],
  );

  const remove = useCallback(
    async (videoId: string) => {
      await persist(items.filter((i) => i.videoId !== videoId));
    },
    [items, persist],
  );

  const isSaved = useCallback((videoId: string) => items.some((i) => i.videoId === videoId), [items]);

  const value = useMemo<LibraryContextValue>(
    () => ({ items, isReady, save, remove, isSaved }),
    [items, isReady, save, remove, isSaved],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider");
  return ctx;
}
