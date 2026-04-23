import * as FileSystem from "expo-file-system/legacy";
import { Linking, Platform } from "react-native";

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
  return name.replace(/[^\w\u0980-\u09FF\s.-]+/g, "_").slice(0, 80).trim();
}

export async function downloadMedia(
  url: string,
  filename: string,
  format: DownloadFormat,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return { uri: url, size: 0 };
  }
  const dir = FileSystem.documentDirectory! + "Nixo/";
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
  const target = dir + safeName(filename) + "." + format;
  const dl = FileSystem.createDownloadResumable(
    url,
    target,
    {},
    (p) => {
      if (onProgress) {
        const total = p.totalBytesExpectedToWrite || 1;
        onProgress({
          totalBytes: total,
          writtenBytes: p.totalBytesWritten,
          ratio: p.totalBytesWritten / total,
        });
      }
    },
  );
  const res = await dl.downloadAsync();
  if (!res) throw new Error("Download failed");
  const info = await FileSystem.getInfoAsync(res.uri);
  return { uri: res.uri, size: (info as { size?: number }).size ?? 0 };
}
