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

async function pipedFetch<T>(path: string): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
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

export function pipedStream(videoId: string) {
  return pipedFetch<PipedStreamDetails>(`/streams/${videoId}`);
}

export function pipedChannel(channelId: string) {
  return pipedFetch<PipedChannel>(`/channel/${channelId}`);
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
