import { Linking, Platform } from "react-native";

import { apiRoot } from "./piped";

export type DownloadFormat = "m4a" | "mp4" | "webm";

export interface DownloadProgress {
  totalBytes: number;
  writtenBytes: number;
  ratio: number;
}

export interface DownloadResult {
  uri: string;
  size: number;
}

function safeName(name: string) {
  return name.replace(/[^\w\u0980-\u09FF\s.-]+/g, "_").slice(0, 80).trim() || "download";
}

export async function downloadMedia(
  url: string,
  filename: string,
  format: DownloadFormat,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  const fullName = `${safeName(filename)}.${format}`;
  const proxied = `${apiRoot()}/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fullName)}`;

  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = proxied;
      a.download = fullName;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      await Linking.openURL(proxied);
    }
    onProgress?.({ totalBytes: 1, writtenBytes: 1, ratio: 1 });
    return { uri: proxied, size: 0 };
  }

  // Native: lazy-import legacy file system to avoid touching it on web bundles
  const FileSystem = await import("expo-file-system/legacy");
  const dir = (FileSystem.documentDirectory as string) + "Nixo/";
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* ignore */
  }
  const target = dir + fullName;
  const dl = FileSystem.createDownloadResumable(url, target, {}, (p) => {
    if (onProgress) {
      const total = p.totalBytesExpectedToWrite || 1;
      onProgress({
        totalBytes: total,
        writtenBytes: p.totalBytesWritten,
        ratio: Math.min(1, p.totalBytesWritten / total),
      });
    }
  });
  const res = await dl.downloadAsync();
  if (!res) throw new Error("Download failed");
  const info = await FileSystem.getInfoAsync(res.uri);
  return { uri: res.uri, size: (info as { size?: number }).size ?? 0 };
}
