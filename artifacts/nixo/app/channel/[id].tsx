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
  pipedChannelTab,
  pipedSearch,
  pipedStream,
  type PipedChannelTab,
  type PipedPlaylistItem,
  type PipedSearchItem,
  type PipedStreamItem,
} from "@/lib/piped";

type ChannelMode = "video" | "music";

// Tabs for music artists (YT Music style)
type MusicTab = "songs" | "albums" | "playlists" | "videos" | "about";
const MUSIC_TABS: { key: MusicTab; label: string }[] = [
  { key: "songs", label: "Songs" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
  { key: "videos", label: "Videos" },
  { key: "about", label: "About" },
];

// Tabs for regular video channels (YouTube style)
type VideoTab =
  | "videos"
  | "shorts"
  | "live"
  | "playlists"
  | "podcasts"
  | "releases"
  | "courses"
  | "about";

// Map Piped tab name → label / key. Videos uses `relatedStreams` from the
// channel root (Piped doesn't expose a separate "videos" tab for most channels).
const VIDEO_TAB_LABELS: Record<string, { key: VideoTab; label: string; order: number }> = {
  shorts: { key: "shorts", label: "Shorts", order: 2 },
  livestreams: { key: "live", label: "Live", order: 3 },
  playlists: { key: "playlists", label: "Playlists", order: 4 },
  podcasts: { key: "podcasts", label: "Podcasts", order: 5 },
  releases: { key: "releases", label: "Releases", order: 6 },
  albums: { key: "releases", label: "Releases", order: 6 },
  courses: { key: "courses", label: "Courses", order: 7 },
};

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
    mode?: ChannelMode;
  }>();
  const id = params.id;
  const fallbackName = params.name ?? "";
  const fallbackSubs = params.subs ? Number(params.subs) : undefined;
  const fallbackAvatar = params.avatar ?? "";
  const mode: ChannelMode = params.mode === "music" ? "music" : "video";

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const { addDownload } = useLibrary();
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

  // ---- MUSIC mode: artist shelves via search ----
  const enableMusic = mode === "music" && !!artistName;
  const [songsQ, albumsQ, playlistsQ, mvQ] = useQueries({
    queries: [
      {
        queryKey: ["ch-songs", artistName],
        queryFn: () => pipedSearch(artistName, "music_songs"),
        enabled: enableMusic,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-albums", artistName],
        queryFn: () => pipedSearch(artistName, "music_albums"),
        enabled: enableMusic,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-playlists", artistName],
        queryFn: () => pipedSearch(artistName, "music_playlists"),
        enabled: enableMusic,
        staleTime: 1000 * 60 * 10,
      },
      {
        queryKey: ["ch-mv", artistName],
        queryFn: () => pipedSearch(artistName, "music_videos"),
        enabled: enableMusic,
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

  const playlistsMusic = useMemo<PipedPlaylistItem[]>(() => {
    return (playlistsQ.data?.items ?? []).filter(isPlaylist);
  }, [playlistsQ.data]);

  // ---- VIDEO mode: dynamic tabs from Piped channel.tabs ----
  const channelTabs = data?.tabs ?? [];
  const availableVideoTabs = useMemo(() => {
    const out: { key: VideoTab; label: string; order: number; data?: string }[] = [
      { key: "videos", label: "Videos", order: 1 },
    ];
    const seen = new Set<VideoTab>(["videos"]);
    for (const t of channelTabs) {
      const meta = VIDEO_TAB_LABELS[t.name?.toLowerCase()];
      if (meta && !seen.has(meta.key)) {
        out.push({ ...meta, data: t.data });
        seen.add(meta.key);
      }
    }
    out.push({ key: "about", label: "About", order: 99 });
    return out.sort((a, b) => a.order - b.order);
  }, [channelTabs]);

  const [musicTab, setMusicTab] = useState<MusicTab>("songs");
  const [videoTab, setVideoTab] = useState<VideoTab>("videos");

  // Lazy-load each video-mode tab's content from Piped's /channels/tabs?data=...
  const findTabData = (key: VideoTab): string | undefined =>
    availableVideoTabs.find((t) => t.key === key)?.data;

  const shortsTabQ = useQuery({
    queryKey: ["ch-tab", id, "shorts", findTabData("shorts") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("shorts")!),
    enabled: mode === "video" && !!findTabData("shorts") && videoTab === "shorts",
    staleTime: 1000 * 60 * 10,
  });
  const liveTabQ = useQuery({
    queryKey: ["ch-tab", id, "live", findTabData("live") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("live")!),
    enabled: mode === "video" && !!findTabData("live") && videoTab === "live",
    staleTime: 1000 * 60 * 10,
  });
  const playlistsTabQ = useQuery({
    queryKey: ["ch-tab", id, "playlists", findTabData("playlists") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("playlists")!),
    enabled: mode === "video" && !!findTabData("playlists") && videoTab === "playlists",
    staleTime: 1000 * 60 * 10,
  });
  const podcastsTabQ = useQuery({
    queryKey: ["ch-tab", id, "podcasts", findTabData("podcasts") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("podcasts")!),
    enabled: mode === "video" && !!findTabData("podcasts") && videoTab === "podcasts",
    staleTime: 1000 * 60 * 10,
  });
  const releasesTabQ = useQuery({
    queryKey: ["ch-tab", id, "releases", findTabData("releases") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("releases")!),
    enabled: mode === "video" && !!findTabData("releases") && videoTab === "releases",
    staleTime: 1000 * 60 * 10,
  });
  const coursesTabQ = useQuery({
    queryKey: ["ch-tab", id, "courses", findTabData("courses") ?? ""],
    queryFn: () => pipedChannelTab(findTabData("courses")!),
    enabled: mode === "video" && !!findTabData("courses") && videoTab === "courses",
    staleTime: 1000 * 60 * 10,
  });

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
    const queue = songs.slice(0, 20);
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

  const tabsList: { key: string; label: string }[] =
    mode === "music"
      ? MUSIC_TABS
      : availableVideoTabs.map((t) => ({ key: t.key, label: t.label }));

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
              {mode === "music" ? "Artist" : "Channel"}
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
        {mode === "music" && songs.length > 0 ? (
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
        {tabsList.map((t) => {
          const active = mode === "music" ? musicTab === t.key : videoTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                if (mode === "music") setMusicTab(t.key as MusicTab);
                else setVideoTab(t.key as VideoTab);
              }}
              style={styles.tabBtn}
            >
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

  const renderSongRow = ({ item, index }: { item: PipedStreamItem; index: number }) => (
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

  const renderAlbumCard = ({ item }: { item: PipedPlaylistItem }) => {
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
            {item.uploaderName}
          </Text>
        ) : (
          <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
            Playlist · {item.videos > 0 ? `${item.videos} videos` : ""}
          </Text>
        )}
      </Pressable>
    );
  };

  const Empty = ({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) => (
    <View style={styles.empty}>
      <Feather name={icon} size={22} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  const Loading = () => (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  const renderTabContent = () => {
    // ============== MUSIC MODE ==============
    if (mode === "music") {
      if (musicTab === "about") {
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
      if (musicTab === "songs") {
        if (songsQ.isLoading) return <Loading />;
        if (songs.length === 0) return <Empty icon="music" label="No songs found" />;
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
                    backgroundColor: bulkProgress.active ? colors.muted : colors.secondary,
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
              <View key={`${it.url}-${i}`}>{renderSongRow({ item: it, index: i })}</View>
            ))}
          </View>
        );
      }
      if (musicTab === "playlists") {
        if (playlistsQ.isLoading) return <Loading />;
        if (playlistsMusic.length === 0) return <Empty icon="list" label="No playlists found" />;
        return (
          <View style={styles.albumGrid}>
            {playlistsMusic.slice(0, 24).map((it) => (
              <View key={it.url} style={{ width: "50%" }}>
                {renderAlbumCard({ item: it })}
              </View>
            ))}
          </View>
        );
      }
      if (musicTab === "albums") {
        if (albumsQ.isLoading) return <Loading />;
        if (albums.length === 0) return <Empty icon="disc" label="No albums found" />;
        return (
          <View style={styles.albumGrid}>
            {albums.slice(0, 24).map((it) => (
              <View key={it.url} style={{ width: "50%" }}>
                {renderAlbumCard({ item: it })}
              </View>
            ))}
          </View>
        );
      }
      // music videos
      const videosArr = (() => {
        const fromChannel = (data?.relatedStreams ?? []).filter(Boolean);
        if (fromChannel.length > 0) return fromChannel;
        const items = (mvQ.data?.items ?? []).filter(isStream);
        return items.filter((it) => matchesUploader(it.uploaderName, artistName));
      })();
      if (channel.isLoading || mvQ.isLoading) return <Loading />;
      if (videosArr.length === 0) return <Empty icon="video-off" label="No videos available" />;
      return (
        <View>
          {videosArr.slice(0, 30).map((it, i) => (
            <VideoCard key={`${it.url}-${i}`} item={it} variant="feed" />
          ))}
        </View>
      );
    }

    // ============== VIDEO MODE ==============
    if (videoTab === "about") {
      return (
        <View style={styles.aboutBox}>
          {data?.description ? (
            <Text style={[styles.desc, { color: colors.foreground }]}>{data.description}</Text>
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No description available.
            </Text>
          )}
          {formatSubs(subs) ? (
            <Text style={[styles.aboutMeta, { color: colors.mutedForeground }]}>
              {formatSubs(subs)}
            </Text>
          ) : null}
        </View>
      );
    }
    if (videoTab === "videos") {
      // Videos: recent uploads (relatedStreams from /channel/:id)
      if (channel.isLoading) return <Loading />;
      const items = data?.relatedStreams ?? [];
      if (items.length === 0)
        return <Empty icon="video-off" label="No videos available" />;
      return (
        <View>
          {items.slice(0, 30).map((it, i) => (
            <VideoCard key={`${it.url}-${i}`} item={it} variant="feed" />
          ))}
        </View>
      );
    }
    if (videoTab === "shorts" || videoTab === "live") {
      const q = videoTab === "shorts" ? shortsTabQ : liveTabQ;
      if (q.isLoading) return <Loading />;
      const items = (q.data?.content ?? []).filter(isStream);
      if (items.length === 0)
        return (
          <Empty
            icon={videoTab === "shorts" ? "zap" : "radio"}
            label={videoTab === "shorts" ? "No shorts available" : "No streams available"}
          />
        );
      return (
        <View>
          {items.slice(0, 50).map((it, i) => (
            <VideoCard key={`${it.url}-${i}`} item={it} variant="feed" />
          ))}
        </View>
      );
    }
    if (videoTab === "playlists" || videoTab === "podcasts" || videoTab === "releases") {
      const q =
        videoTab === "playlists"
          ? playlistsTabQ
          : videoTab === "podcasts"
          ? podcastsTabQ
          : releasesTabQ;
      if (q.isLoading) return <Loading />;
      const items = (q.data?.content ?? []).filter(isPlaylist);
      if (items.length === 0)
        return (
          <Empty
            icon="list"
            label={
              videoTab === "playlists"
                ? "No playlists yet"
                : videoTab === "podcasts"
                ? "No podcasts yet"
                : "No releases yet"
            }
          />
        );
      return (
        <View style={styles.albumGrid}>
          {items.slice(0, 30).map((it) => (
            <View key={it.url} style={{ width: "50%" }}>
              {renderAlbumCard({ item: it })}
            </View>
          ))}
        </View>
      );
    }
    if (videoTab === "courses") {
      if (coursesTabQ.isLoading) return <Loading />;
      const items = (coursesTabQ.data?.content ?? []).filter(isPlaylist);
      if (items.length === 0) return <Empty icon="book-open" label="No courses available" />;
      return (
        <View style={styles.albumGrid}>
          {items.slice(0, 30).map((it) => (
            <View key={it.url} style={{ width: "50%" }}>
              {renderAlbumCard({ item: it })}
            </View>
          ))}
        </View>
      );
    }
    return null;
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
          renderItem={() => <View>{renderTabContent()}</View>}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <BottomNav />
    </View>
  );
}

// Suppress unused-symbol warning while keeping the type exported via lib.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = PipedChannelTab;

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
  aboutMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 12 },
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
