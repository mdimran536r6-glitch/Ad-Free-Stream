import { Platform } from "react-native";

export function apiRoot(): string {
  if (Platform.OS === "web") return "/api";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

function apiBase(): string {
  return apiRoot() + "/piped";
}

// Rewrites Piped proxy image/asset URLs to hit YouTube CDNs directly so dead
// Piped instances don't leave us with broken thumbnails. Pattern:
//   https://<piped-proxy-host>/<path>?host=<original-host>&...
//   -> https://<original-host>/<path>?<rest>
function unpipeUrl(u: string): string {
  if (!u || typeof u !== "string") return u;
  if (!/^https?:\/\/[^/]*pip|googleusercontent|ytimg/i.test(u)) return u;
  try {
    const m = u.match(/^https?:\/\/[^/]+(\/[^?#]*)\?(.*)$/);
    if (!m) return u;
    const path = m[1];
    const params = new URLSearchParams(m[2]);
    const host = params.get("host");
    if (!host) return u;
    params.delete("host");
    const rest = params.toString();
    return `https://${host}${path}${rest ? `?${rest}` : ""}`;
  } catch {
    return u;
  }
}

function rewriteAssets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return unpipeUrl(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => rewriteAssets(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = rewriteAssets(v);
    return out as unknown as T;
  }
  return value;
}

async function pipedFetch<T>(path: string): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as T;
  return rewriteAssets(data);
}

export interface PipedStreamItem {
  url: string;
  type: "stream";
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl?: string;
  uploaderAvatar?: string | null;
  uploadedDate?: string | null;
  duration: number;
  views: number;
  uploaded?: number;
  shortDescription?: string | null;
}

export interface PipedChannelItem {
  url: string;
  type: "channel";
  name: string;
  thumbnail: string;
  description?: string;
  subscribers: number;
  videos: number;
}

export interface PipedPlaylistItem {
  url: string;
  type: "playlist";
  name: string;
  thumbnail: string;
  uploaderName?: string;
  videos: number;
}

export type PipedSearchItem = PipedStreamItem | PipedChannelItem | PipedPlaylistItem;

export interface PipedStreamDetails {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  uploaderSubscriberCount: number;
  thumbnailUrl: string;
  duration: number;
  views: number;
  likes: number;
  audioStreams: AudioStream[];
  videoStreams: VideoStream[];
  hls?: string;
  relatedStreams: PipedStreamItem[];
}

export interface AudioStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  bitrate: number;
  codec: string;
  audioTrackName?: string;
}

export interface VideoStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  width: number;
  height: number;
  bitrate: number;
  videoOnly: boolean;
}

export interface PipedChannel {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl: string;
  description: string;
  subscriberCount: number;
  verified: boolean;
  relatedStreams: PipedStreamItem[];
}

export function extractVideoId(url: string): string {
  const m = url.match(/(?:v=|\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  if (url.startsWith("/watch?v=")) return url.replace("/watch?v=", "").split("&")[0];
  return url;
}

export function extractChannelId(url: string): string {
  if (url.startsWith("/channel/")) return url.replace("/channel/", "");
  const m = url.match(/\/channel\/([\w-]+)/);
  return m ? m[1] : url;
}

export function pipedTrending(region = "BD") {
  return pipedFetch<PipedStreamItem[]>(`/trending?region=${region}`);
}

export type SearchFilter =
  | "all"
  | "videos"
  | "channels"
  | "playlists"
  | "music_songs"
  | "music_videos"
  | "music_albums"
  | "music_playlists"
  | "music_artists";

export interface PipedSearchResponse {
  items: PipedSearchItem[];
  nextpage?: string | null;
  suggestion?: string | null;
  corrected?: boolean;
}

export function pipedSearch(query: string, filter: SearchFilter = "all") {
  return pipedFetch<PipedSearchResponse>(
    `/search?q=${encodeURIComponent(query)}&filter=${filter}`,
  );
}

export function pipedSearchNextPage(query: string, nextpage: string, filter: SearchFilter = "all") {
  return pipedFetch<PipedSearchResponse>(
    `/nextpage/search?nextpage=${encodeURIComponent(nextpage)}&q=${encodeURIComponent(query)}&filter=${filter}`,
  );
}

export function pipedSuggestions(query: string) {
  return pipedFetch<string[]>(`/suggestions?query=${encodeURIComponent(query)}`);
}

export async function pipedStream(videoId: string): Promise<PipedStreamDetails> {
  const url = `${apiRoot()}/streams/${videoId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as PipedStreamDetails;
  // Only rewrite metadata/thumbnail fields; preserve actual stream URLs
  return {
    ...data,
    thumbnailUrl: unpipeUrl(data.thumbnailUrl),
    uploaderAvatar: unpipeUrl(data.uploaderAvatar),
    relatedStreams: rewriteAssets(data.relatedStreams ?? []),
  };
}

export function pipedChannel(channelId: string) {
  return pipedFetch<PipedChannel>(`/channel/${channelId}`);
}

export interface PipedPlaylistDetails {
  name: string;
  thumbnailUrl: string;
  bannerUrl?: string;
  uploader: string;
  uploaderAvatar?: string;
  uploaderUrl?: string;
  videos: number;
  relatedStreams: PipedStreamItem[];
}

export function pipedPlaylist(playlistId: string) {
  return pipedFetch<PipedPlaylistDetails>(`/playlists/${playlistId}`);
}

export function mediaProxy(url: string): string {
  if (Platform.OS !== "web") return url;
  if (!url) return url;
  return `${apiRoot()}/proxy?url=${encodeURIComponent(url)}`;
}

export function timeAgo(input?: string | number | null): string {
  if (!input) return "";
  let ts: number;
  if (typeof input === "number") {
    ts = input;
  } else {
    const parsed = Date.parse(input);
    if (isNaN(parsed)) return input;
    ts = parsed;
  }
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatViews(views: number): string {
  if (!views || views < 0) return "0 views";
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

export function bestAudio(streams: AudioStream[]): AudioStream | null {
  if (!streams || streams.length === 0) return null;
  const sorted = [...streams].sort((a, b) => b.bitrate - a.bitrate);
  return sorted[0];
}

export function pickVideoStream(streams: VideoStream[], targetHeight = 480): VideoStream | null {
  if (!streams || streams.length === 0) return null;
  const muxed = streams.filter((s) => !s.videoOnly);
  const pool = muxed.length > 0 ? muxed : streams;
  const sorted = [...pool].sort((a, b) => Math.abs(a.height - targetHeight) - Math.abs(b.height - targetHeight));
  return sorted[0];
}
