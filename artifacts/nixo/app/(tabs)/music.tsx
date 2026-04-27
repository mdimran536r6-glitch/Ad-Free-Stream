import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import {
  extractChannelId,
  extractVideoId,
  pipedSearch,
  pipedSearchNextPage,
  type PipedSearchItem,
  type PipedStreamItem,
} from "@/lib/piped";

type Mood = { key: string; q: string };
const MOODS: Mood[] = [
  { key: "Trending", q: "" },
  { key: "Bangla", q: "bangla songs new" },
  { key: "Hindi", q: "bollywood hits" },
  { key: "English", q: "top hits english" },
  { key: "Lo-fi", q: "lofi music" },
  { key: "Workout", q: "workout music" },
  { key: "Chill", q: "chill music" },
  { key: "Devotional", q: "devotional songs" },
  { key: "Romantic", q: "romantic songs new" },
  { key: "Party", q: "party songs" },
];

// Curated worldwide trending music queries — Piped's /trending endpoint returns
// general videos (vlogs/news/reality), so we use targeted music searches instead.
const TRENDING_MUSIC_QUERIES = [
  "billboard hot 100 this week",
  "global top 50 spotify",
  "trending music this week",
  "top hits 2026",
  "viral music tiktok 2026",
  "k-pop hits trending",
  "afrobeats hits 2026",
  "latin hits global",
  "bollywood top songs new",
  "bangla hits new",
] as const;

function dedupeByVideoId(items: PipedStreamItem[]): PipedStreamItem[] {
  const seen = new Set<string>();
  const out: PipedStreamItem[] = [];
  for (const it of items) {
    const id = extractVideoId(it.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatCount(n?: number | null): string {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const LOGO_HEIGHT = 52;
const CHIPS_HEIGHT = 48;
const HEADER_HEIGHT = LOGO_HEIGHT + CHIPS_HEIGHT;

export default function MusicScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const [mood, setMood] = useState(MOODS[0]);
  const [seed, setSeed] = useState<number>(Date.now());

  // YT Music-style: logo bar slides up and hides, chips bar stays sticky at the top.
  // Pull up even slightly → logo reappears above the chips.
  const lastY = useRef(0);
  const offsetY = useRef(0);
  const headerTranslate = useRef(new Animated.Value(0)).current;

  // Infinite-scroll "More music" feed at the bottom. Uses a representative
  // music query for the active mood and paginates via Piped's nextpage tokens.
  const moreQ = mood.q || "trending music this week";
  const moreInfinite = useInfiniteQuery({
    queryKey: ["m-more", moreQ],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (pageParam) return pipedSearchNextPage(moreQ, pageParam, "music_songs");
      return pipedSearch(moreQ, "music_songs");
    },
    getNextPageParam: (last) => last?.nextpage ?? null,
    staleTime: 1000 * 60 * 10,
  });

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < 0) return;
      let next = offsetY.current + dy;
      // Only translate by LOGO_HEIGHT — chips stay visible, logo hides above viewport
      next = Math.max(0, Math.min(LOGO_HEIGHT, next));
      offsetY.current = next;
      headerTranslate.setValue(-next);

      // Infinite scroll: when within 600px of the bottom, fetch the next
      // page of "More music".
      const layoutH = e.nativeEvent.layoutMeasurement.height;
      const contentH = e.nativeEvent.contentSize.height;
      if (
        contentH > 0 &&
        y + layoutH > contentH - 600 &&
        moreInfinite.hasNextPage &&
        !moreInfinite.isFetchingNextPage
      ) {
        moreInfinite.fetchNextPage();
      }
    },
    [headerTranslate, moreInfinite],
  );

  const snapHeader = useCallback(() => {
    const cur = offsetY.current;
    const target = cur > LOGO_HEIGHT / 2 ? LOGO_HEIGHT : 0;
    if (target === cur) return;
    offsetY.current = target;
    Animated.timing(headerTranslate, {
      toValue: -target,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [headerTranslate]);

  const isTrending = mood.key === "Trending";

  // Worldwide trending music — fan out across multiple curated music searches,
  // dedupe & merge. This gives real music (Billboard/Spotify-style) rather than
  // vlogs from the /trending endpoint.
  const trendingQ = useQuery({
    queryKey: ["m-global-trending", seed],
    enabled: isTrending,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        TRENDING_MUSIC_QUERIES.map((q) => pipedSearch(q, "music_songs")),
      );
      const flat: PipedStreamItem[] = [];
      for (const s of settled) {
        if (s.status === "fulfilled" && Array.isArray(s.value?.items)) {
          for (const it of s.value.items) {
            if (it && it.type === "stream") flat.push(it as PipedStreamItem);
          }
        }
      }
      // Drop items with absurd durations (full albums / hour-long mixes).
      const cleaned = dedupeByVideoId(flat).filter(
        (it) => !it.duration || (it.duration >= 30 && it.duration <= 900),
      );
      return shuffle(cleaned);
    },
  });

  // Search-based mood feeds (skipped when trending mode is active)
  const searchEnabled = !isTrending;
  const queries = useQueries({
    queries: [
      { queryKey: ["m-songs", mood.q, seed], queryFn: () => pipedSearch(mood.q, "music_songs"), staleTime: 1000 * 60 * 5, enabled: searchEnabled },
      { queryKey: ["m-vids", mood.q, seed], queryFn: () => pipedSearch(mood.q, "music_videos"), staleTime: 1000 * 60 * 5, enabled: searchEnabled },
      { queryKey: ["m-albums", mood.q, seed], queryFn: () => pipedSearch(mood.q, "music_albums"), staleTime: 1000 * 60 * 5, enabled: searchEnabled },
      { queryKey: ["m-artists", mood.q, seed], queryFn: () => pipedSearch(mood.q, "music_artists"), staleTime: 1000 * 60 * 5, enabled: searchEnabled },
      { queryKey: ["m-playlists", mood.q, seed], queryFn: () => pipedSearch(mood.q, "music_playlists"), staleTime: 1000 * 60 * 5, enabled: searchEnabled },
    ],
  });

  // For Trending mode, fall back to a worldwide artist/album probe so the
  // "Artists / Albums" shelves are not empty. Cheap because it's a single search.
  const trendingExtras = useQueries({
    queries: [
      { queryKey: ["m-tr-artists", seed], queryFn: () => pipedSearch("top artists worldwide", "music_artists"), staleTime: 1000 * 60 * 30, enabled: isTrending },
      { queryKey: ["m-tr-albums", seed], queryFn: () => pipedSearch("top albums 2026", "music_albums"), staleTime: 1000 * 60 * 30, enabled: isTrending },
      { queryKey: ["m-tr-playlists", seed], queryFn: () => pipedSearch("top music playlists", "music_playlists"), staleTime: 1000 * 60 * 30, enabled: isTrending },
    ],
  });

  const [songs, vids, albums, artists, playlists] = queries;
  const [trArtists, trAlbums, trPlaylists] = trendingExtras;

  const moreItems = useMemo<PipedStreamItem[]>(() => {
    const flat: PipedStreamItem[] = [];
    for (const page of moreInfinite.data?.pages ?? []) {
      for (const it of page.items ?? []) {
        if (it.type === "stream") flat.push(it);
      }
    }
    return dedupeByVideoId(flat);
  }, [moreInfinite.data]);

  // SONGS / VIDEOS shelves
  const songItems = useMemo<PipedStreamItem[]>(() => {
    if (isTrending) return trendingQ.data ?? [];
    return filterStreams(songs.data?.items);
  }, [isTrending, trendingQ.data, songs.data]);

  const videoItems = useMemo<PipedStreamItem[]>(() => {
    if (isTrending) {
      // Re-use trending pool — show longer/MV-style entries first
      return [...(trendingQ.data ?? [])]
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 20);
    }
    return filterStreams(vids.data?.items);
  }, [isTrending, trendingQ.data, vids.data]);

  // ALBUMS / ARTISTS / PLAYLISTS shelves
  const albumsSrc = isTrending ? trAlbums.data?.items : albums.data?.items;
  const artistsSrc = isTrending ? trArtists.data?.items : artists.data?.items;
  const playlistsSrc = isTrending ? trPlaylists.data?.items : playlists.data?.items;

  const albumItems = (albumsSrc ?? []).filter((i) => i.type === "playlist") as Extract<
    PipedSearchItem,
    { type: "playlist" }
  >[];
  const artistItems = (artistsSrc ?? []).filter(
    (i) => i.type === "channel" && !!extractChannelId(i.url),
  ) as Extract<PipedSearchItem, { type: "channel" }>[];
  const playlistItems = (playlistsSrc ?? []).filter((i) => i.type === "playlist") as Extract<
    PipedSearchItem,
    { type: "playlist" }
  >[];

  const isLoading = isTrending
    ? trendingQ.isLoading
    : queries.every((q) => q.isLoading);
  const hero = songItems[0];

  const handleMoodPress = (m: typeof MOODS[number]) => {
    if (m.key === mood.key) {
      setSeed(Date.now());
    } else {
      setMood(m);
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Combined header: logo + chips slide up together (YT Music-style) */}
      <Animated.View
        style={[
          styles.headerWrap,
          {
            paddingTop: topPad,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            transform: [{ translateY: headerTranslate }],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandCircle, { borderColor: colors.primary }]}>
              <Feather name="play" size={9} color={colors.primary} style={{ marginLeft: 1 }} />
            </View>
            <Text style={[styles.brand, { color: colors.foreground }]}>Music</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={10} onPress={() => setSeed(Date.now())} style={styles.iconBtn}>
            <Feather name="refresh-cw" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable hitSlop={10} onPress={() => router.push("/search")} style={styles.iconBtn}>
            <Feather name="search" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.chipsBar}>
          <FlatList
            horizontal
            data={MOODS}
            keyExtractor={(m) => m.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item: m }) => {
              const active = mood.key === m.key;
              return (
                <Pressable
                  onPress={() => handleMoodPress(m)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? colors.foreground : colors.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.background : colors.foreground },
                    ]}
                  >
                    {m.key}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{
          paddingTop: topPad + HEADER_HEIGHT,
          paddingBottom: 150,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onScrollEndDrag={snapHeader}
        onMomentumScrollEnd={snapHeader}
        scrollEventThrottle={16}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {hero ? <Hero item={hero} onPlay={play} colors={colors} /> : null}

            {songItems.length > 0 ? (
              <>
                <SectionHeader title="Quick picks" colors={colors} />
                <View style={styles.quickGrid}>
                  {songItems.slice(0, 8).map((it) => (
                    <SongTile key={it.url} item={it} onPlay={play} colors={colors} />
                  ))}
                </View>
              </>
            ) : null}

            {albumItems.length > 0 ? (
              <>
                <SectionHeader title="Albums & playlists" colors={colors} />
                <FlatList
                  horizontal
                  data={albumItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        const pid = item.url.replace(/^\/playlist\?list=/, "").replace(/^\//, "");
                        router.push(`/playlist/${encodeURIComponent(pid)}`);
                      }}
                      style={styles.albumCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
                        {item.uploaderName ?? `${item.videos} songs`}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {videoItems.length > 0 ? (
              <>
                <SectionHeader title="Music videos" colors={colors} />
                <FlatList
                  horizontal
                  data={videoItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => router.push(`/video/${extractVideoId(item.url)}`)}
                      style={styles.mvCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.mvArt} contentFit="cover" />
                      <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
                        {item.uploaderName}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {artistItems.length > 0 ? (
              <>
                <SectionHeader title="Artists" colors={colors} />
                <FlatList
                  horizontal
                  data={artistItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => {
                    const cid = extractChannelId(item.url);
                    const subs = formatCount(item.subscribers);
                    return (
                      <Pressable
                        onPress={() => {
                          if (!cid) return;
                          router.push({
                            pathname: "/channel/[id]",
                            params: {
                              id: cid,
                              name: item.name,
                              subs: String(item.subscribers ?? ""),
                              avatar: item.thumbnail ?? "",
                            },
                          });
                        }}
                        style={styles.artistCard}
                      >
                        <Image source={{ uri: item.thumbnail }} style={styles.artistAvatar} contentFit="cover" />
                        <Text numberOfLines={1} style={[styles.albumTitle, { color: colors.foreground, textAlign: "center" }]}>
                          {item.name}
                        </Text>
                        <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground, textAlign: "center" }]}>
                          {subs ? `${subs} subscribers` : "Artist"}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            ) : null}

            {playlistItems.length > 0 ? (
              <>
                <SectionHeader title="Recommended playlists" colors={colors} />
                <FlatList
                  horizontal
                  data={playlistItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        const pid = item.url.replace(/^\/playlist\?list=/, "").replace(/^\//, "");
                        router.push(`/playlist/${encodeURIComponent(pid)}`);
                      }}
                      style={styles.albumCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
                        {item.uploaderName ?? `${item.videos} songs`}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {moreItems.length > 0 ? (
              <>
                <SectionHeader title="More music" colors={colors} />
                <View style={{ paddingHorizontal: 8 }}>
                  {moreItems.map((it) => {
                    const id = extractVideoId(it.url);
                    return (
                      <Pressable
                        key={`more-${it.url}`}
                        onPress={() =>
                          play({
                            videoId: id,
                            title: it.title,
                            artist: it.uploaderName,
                            thumbnail: it.thumbnail,
                          })
                        }
                        style={styles.moreRow}
                      >
                        <Image
                          source={{ uri: it.thumbnail }}
                          style={styles.moreThumb}
                          contentFit="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={[styles.quickTitle, { color: colors.foreground }]}
                          >
                            {it.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.quickArtist, { color: colors.mutedForeground }]}
                          >
                            {it.uploaderName}
                          </Text>
                        </View>
                        <Feather name="play" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    );
                  })}
                </View>
                {moreInfinite.isFetchingNextPage ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : moreInfinite.hasNextPage ? (
                  <Pressable
                    onPress={() => moreInfinite.fetchNextPage()}
                    style={{ paddingVertical: 14, alignItems: "center" }}
                  >
                    <Text style={[styles.quickArtist, { color: colors.primary }]}>
                      Load more
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function Hero({
  item,
  onPlay,
  colors,
}: {
  item: PipedStreamItem;
  onPlay: (t: { videoId: string; title: string; artist: string; thumbnail: string }) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const id = extractVideoId(item.url);
  return (
    <View style={[styles.hero, { backgroundColor: colors.muted }]}>
      <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
      <LinearGradient
        colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.7)", colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroBody}>
        <Image source={{ uri: item.thumbnail }} style={styles.heroArt} contentFit="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Top pick for you</Text>
          <Text numberOfLines={2} style={[styles.heroTitle, { color: colors.foreground }]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={[styles.heroArtist, { color: colors.mutedForeground }]}>
            {item.uploaderName}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() =>
                onPlay({ videoId: id, title: item.title, artist: item.uploaderName, thumbnail: item.thumbnail })
              }
              style={[styles.heroPlay, { backgroundColor: colors.foreground }]}
            >
              <Feather name="play" size={14} color={colors.background} />
              <Text style={[styles.heroPlayText, { color: colors.background }]}>Play</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function SongTile({
  item,
  onPlay,
  colors,
}: {
  item: PipedStreamItem;
  onPlay: (t: { videoId: string; title: string; artist: string; thumbnail: string }) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [menu, setMenu] = useState(false);
  const id = extractVideoId(item.url);
  return (
    <>
      <Pressable
        onPress={() =>
          onPlay({ videoId: id, title: item.title, artist: item.uploaderName, thumbnail: item.thumbnail })
        }
        style={[styles.quickRow, { backgroundColor: colors.secondary }]}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.quickThumb} contentFit="cover" />
        <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text numberOfLines={1} style={[styles.quickTitle, { color: colors.foreground }]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={[styles.quickArtist, { color: colors.mutedForeground }]}>
            {item.uploaderName}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={() => setMenu(true)} style={{ paddingHorizontal: 10 }}>
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
      <VideoActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        videoId={id}
        title={item.title}
        artist={item.uploaderName}
        thumbnail={item.thumbnail}
        duration={item.duration}
        channelUrl={item.uploaderUrl}
      />
    </>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function filterStreams(items?: PipedSearchItem[]): PipedStreamItem[] {
  return ((items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[]);
}

const styles = StyleSheet.create({
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipsBar: {
    height: CHIPS_HEIGHT,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    height: LOGO_HEIGHT,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 20, fontFamily: "Inter_700Bold" },
  iconBtn: { padding: 8 },
  chipsRow: { paddingHorizontal: 12, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginRight: 8, minHeight: 34, justifyContent: "center" },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: -0.1 },

  hero: {
    margin: 14,
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 160,
  },
  heroBody: { flexDirection: "row", padding: 14, gap: 14 },
  heroArt: { width: 110, height: 110, borderRadius: 8, backgroundColor: "#000" },
  heroLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  heroArtist: { fontSize: 13, fontFamily: "Inter_400Regular" },
  heroPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroPlayText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 14,
    marginTop: 22,
    marginBottom: 10,
  },
  quickGrid: { paddingHorizontal: 12, gap: 8 },
  quickRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  quickThumb: { width: 56, height: 56 },

  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  moreThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: "#000" },
  quickTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickArtist: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  hList: { paddingHorizontal: 12, gap: 12 },
  albumCard: { width: 150, marginRight: 12 },
  albumArt: { width: 150, height: 150, borderRadius: 6, backgroundColor: "#000" },
  mvCard: { width: 220, marginRight: 12 },
  mvArt: { width: 220, height: 124, borderRadius: 6, backgroundColor: "#000" },
  albumTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  albumArtist: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  artistCard: { width: 120, alignItems: "center", marginRight: 12, gap: 6 },
  artistAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#000" },
  center: { padding: 60, alignItems: "center" },
});
