import { Feather } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNav } from "@/components/BottomNav";
import { VideoCard } from "@/components/VideoCard";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { downloadMedia } from "@/lib/downloads";
import {
  bestAudio,
  extractVideoId,
  pipedChannel,
  pipedSearch,
  pipedStream,
  type PipedPlaylistItem,
  type PipedSearchItem,
  type PipedStreamItem,
} from "@/lib/piped";

type Tab = "songs" | "albums" | "playlists" | "videos" | "about";
const TABS: { key: Tab; label: string }[] = [
  { key: "songs", label: "Songs" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
  { key: "videos", label: "Videos" },
  { key: "about", label: "About" },
];

function formatSubs(n?: number | null): string {
  if (n == null || n < 0) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B subscribers`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subscribers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K subscribers`;
  if (n === 0) return "";
  return `${n} subscribers`;
}

function isStream(i: PipedSearchItem): i is PipedStreamItem {
  return i.type === "stream";
}
function isPlaylist(i: PipedSearchItem): i is PipedPlaylistItem {
  return i.type === "playlist";
}

// Strip generic suffixes ("- Topic", "VEVO") so search returns the artist itself.
function normalizeArtistName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/\s*-\s*Topic\s*$/i, "").replace(/VEVO\s*$/i, "").trim();
}

function matchesUploader(uploader: string | undefined | null, artist: string): boolean {
  if (!uploader || !artist) return true;
  const u = uploader.toLowerCase();
  const a = artist.toLowerCase();
  return u.includes(a) || a.includes(u.replace(/\s*-\s*topic$/i, "").replace(/\s*vevo$/i, "").trim());
}

export default function ChannelScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    subs?: string;
    avatar?: string;
  }>();
  const id = params.id;
  const fallbackName = params.name ?? "";
  const fallbackSubs = params.subs ? Number(params.subs) : undefined;
  const fallbackAvatar = params.avatar ?? "";

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const { addDownload } = useLibrary();
  const [tab, setTab] = useState<Tab>("songs");
  const [subscribed, setSubscribed] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 0 });

  const channel = useQuery({
    queryKey: ["channel", id],
    queryFn: () => pipedChannel(id!),
    enabled: !!id,
  });

  const data = channel.data;
  const displayName = data?.name || fallbackName;
  const artistName = normalizeArtistName(displayName);
  const avatar = data?.avatarUrl || fallbackAvatar;
  const subsRaw = data?.subscriberCount;
  const subs =
    typeof subsRaw === "number" && subsRaw >= 0 ? subsRaw : fallbackSubs ?? -1;

  // Fan-out search by artist name to populate Songs/Albums/Videos shelves.
  // This is what makes "- Topic" channels (which have empty relatedStreams)
  // actually show content.
  const enableSearch = !!artistName;
  const [songsQ, albumsQ, playlistsQ, mvQ] = useQueries({
    queries: [
      {
        queryKey: ["ch-songs", artistName],
        queryFn: () => pipedSearch(artistName, "music_songs"),
        enabled: enableSearch,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-albums", artistName],
        queryFn: () => pipedSearch(artistName, "music_albums"),
        enabled: enableSearch,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-playlists", artistName],
        queryFn: () => pipedSearch(artistName, "music_playlists"),
        enabled: enableSearch,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-mv", artistName],
        queryFn: () => pipedSearch(artistName, "music_videos"),
        enabled: enableSearch,
        staleTime: 1000 * 60 * 10,
      },
    ],
  });

  const songs = useMemo<PipedStreamItem[]>(() => {
    const items = (songsQ.data?.items ?? []).filter(isStream);
    return items.filter((it) => matchesUploader(it.uploaderName, artistName));
  }, [songsQ.data, artistName]);

  const albums = useMemo<PipedPlaylistItem[]>(() => {
    const items = (albumsQ.data?.items ?? []).filter(isPlaylist);
    return items.filter((it) => matchesUploader(it.uploaderName, artistName));
  }, [albumsQ.data, artistName]);

  const playlists = useMemo<PipedPlaylistItem[]>(() => {
    return (playlistsQ.data?.items ?? []).filter(isPlaylist);
  }, [playlistsQ.data]);

  const videos = useMemo<PipedStreamItem[]>(() => {
    const fromChannel = (data?.relatedStreams ?? []).filter(Boolean);
    if (fromChannel.length > 0) return fromChannel;
    // Fallback: music videos search filtered by uploader.
    const items = (mvQ.data?.items ?? []).filter(isStream);
    return items.filter((it) => matchesUploader(it.uploaderName, artistName));
  }, [data?.relatedStreams, mvQ.data, artistName]);

  if (!id) return null;
  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  const isLoadingHeader = channel.isLoading && !displayName;

  const playSong = (it: PipedStreamItem) => {
    play({
      videoId: extractVideoId(it.url),
      title: it.title,
      artist: it.uploaderName,
      thumbnail: it.thumbnail,
    });
  };

  const downloadAll = async () => {
    if (songs.length === 0 || bulkProgress.active) return;
    const queue = songs.slice(0, 20); // safety cap so we don't blast 100s
    setBulkProgress({ active: true, done: 0, total: queue.length });
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      try {
        const vid = extractVideoId(it.url);
        if (!vid) {
          fail++;
          continue;
        }
        const details = await pipedStream(vid);
        const audio = bestAudio(details.audioStreams);
        if (!audio) {
          fail++;
          continue;
        }
        const res = await downloadMedia(audio.url, it.title, "m4a");
        await addDownload({
          videoId: vid,
          title: it.title,
          artist: it.uploaderName,
          thumbnail: it.thumbnail,
          duration: it.duration ?? 0,
          format: "m4a",
          localUri: res.uri,
          size: res.size,
        });
        ok++;
      } catch {
        fail++;
      }
      setBulkProgress({ active: true, done: i + 1, total: queue.length });
    }
    setBulkProgress({ active: false, done: 0, total: 0 });
    if (Platform.OS === "web") return;
    Alert.alert("Download complete", `${ok} downloaded${fail ? ` · ${fail} failed` : ""}`);
  };

  const Header = (
    <View>
      {data?.bannerUrl ? (
        <Image source={{ uri: data.bannerUrl }} style={styles.banner} contentFit="cover" />
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.muted }]} />
      )}

      <View style={styles.profileRow}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.muted }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
            {data?.verified ? "  ✓" : ""}
          </Text>
          {formatSubs(subs) ? (
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {formatSubs(subs)}
            </Text>
          ) : (
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Artist
            </Text>
          )}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable
          onPress={() => setSubscribed((s) => !s)}
          style={[
            styles.subBtn,
            {
              backgroundColor: subscribed ? colors.secondary : colors.foreground,
            },
          ]}
        >
          <Text
            style={[
              styles.subBtnText,
              { color: subscribed ? colors.foreground : colors.background },
            ]}
          >
            {subscribed ? "SUBSCRIBED" : "SUBSCRIBE"}
          </Text>
        </Pressable>
        {songs.length > 0 ? (
          <Pressable
            onPress={() => playSong(songs[0])}
            style={[styles.playBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="play" size={14} color="#fff" />
            <Text style={styles.playBtnText}>Play</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabBtn}>
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t.label}
              </Text>
              {active ? (
                <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const songsLoading = songsQ.isLoading;
  const albumsLoading = albumsQ.isLoading;
  const videosLoading = channel.isLoading || mvQ.isLoading;

  const renderSong = ({ item, index }: { item: PipedStreamItem; index: number }) => (
    <Pressable onPress={() => playSong(item)} style={styles.songRow}>
      <Text style={[styles.idx, { color: colors.mutedForeground }]}>{index + 1}</Text>
      <Image source={{ uri: item.thumbnail }} style={styles.songThumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.songTitle, { color: colors.foreground }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.songSub, { color: colors.mutedForeground }]}>
          {item.uploaderName}
        </Text>
      </View>
    </Pressable>
  );

  const renderAlbum = ({ item }: { item: PipedPlaylistItem }) => {
    const pid = item.url.replace(/^\/playlist\?list=/, "").replace(/^\//, "");
    return (
      <Pressable
        onPress={() => router.push(`/playlist/${encodeURIComponent(pid)}`)}
        style={styles.albumCard}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
        <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
          {item.name}
        </Text>
        {item.uploaderName ? (
          <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
            Album · {item.uploaderName}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  const TabBody = () => {
    if (tab === "about") {
      return (
        <View style={styles.aboutBox}>
          {data?.description ? (
            <Text style={[styles.desc, { color: colors.foreground }]}>{data.description}</Text>
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No description available.
            </Text>
          )}
        </View>
      );
    }
    if (tab === "songs") {
      if (songsLoading) {
        return (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      }
      if (songs.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="music" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No songs found
            </Text>
          </View>
        );
      }
      return (
        <View style={{ paddingHorizontal: 8 }}>
          <View style={styles.shelfHeader}>
            <Text style={[styles.shelfTitle, { color: colors.foreground }]}>
              {Math.min(songs.length, 30)} songs
            </Text>
            <Pressable
              onPress={downloadAll}
              disabled={bulkProgress.active}
              style={[
                styles.dlAllBtn,
                {
                  backgroundColor: bulkProgress.active
                    ? colors.muted
                    : colors.secondary,
                },
              ]}
            >
              {bulkProgress.active ? (
                <>
                  <ActivityIndicator size="small" color={colors.foreground} />
                  <Text style={[styles.dlAllText, { color: colors.foreground }]}>
                    {bulkProgress.done}/{bulkProgress.total}
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="download" size={14} color={colors.foreground} />
                  <Text style={[styles.dlAllText, { color: colors.foreground }]}>
                    Download all
                  </Text>
                </>
              )}
            </Pressable>
          </View>
          {songs.slice(0, 30).map((it, i) => (
            <View key={`${it.url}-${i}`}>{renderSong({ item: it, index: i })}</View>
          ))}
        </View>
      );
    }
    if (tab === "playlists") {
      if (playlistsQ.isLoading) {
        return (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      }
      if (playlists.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="list" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No playlists found
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.albumGrid}>
          {playlists.slice(0, 24).map((it) => (
            <View key={it.url} style={{ width: "50%" }}>
              {renderAlbum({ item: it })}
            </View>
          ))}
        </View>
      );
    }
    if (tab === "albums") {
      if (albumsLoading) {
        return (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      }
      if (albums.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="disc" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No albums found
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.albumGrid}>
          {albums.slice(0, 24).map((it) => (
            <View key={it.url} style={{ width: "50%" }}>
              {renderAlbum({ item: it })}
            </View>
          ))}
        </View>
      );
    }
    // tab === "videos"
    if (videosLoading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (videos.length === 0) {
      return (
        <View style={styles.empty}>
          <Feather name="video-off" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No videos available
          </Text>
        </View>
      );
    }
    return (
      <View>
        {videos.slice(0, 30).map((it, i) => (
          <VideoCard key={`${it.url}-${i}`} item={it} variant="feed" />
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: topPad + 4,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {isLoadingHeader ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : channel.isError && !displayName ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Could not load channel
          </Text>
          <Pressable
            onPress={() => channel.refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.retryText, { color: colors.background }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={() => "ch"}
          renderItem={() => <TabBody />}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginLeft: 4 },
  iconBtn: { padding: 10 },
  center: { padding: 40, alignItems: "center", gap: 10 },
  empty: { padding: 30, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, marginTop: 6 },
  retryText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  banner: { width: "100%", aspectRatio: 16 / 5 },
  profileRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, gap: 14,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  btnRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    alignItems: "center",
  },
  subBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  subBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  playBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  aboutBox: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  tabsRow: {
    marginTop: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#33333322",
  },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabUnderline: { height: 2, marginTop: 6, borderRadius: 2, alignSelf: "stretch" },

  shelfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  shelfTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dlAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dlAllText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  songRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10, paddingHorizontal: 4 },
  idx: { width: 24, fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  songThumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: "#000" },
  songTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  songSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  albumGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 4 },
  albumCard: { paddingHorizontal: 6, paddingVertical: 8 },
  albumArt: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#000" },
  albumTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  albumArtist: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
