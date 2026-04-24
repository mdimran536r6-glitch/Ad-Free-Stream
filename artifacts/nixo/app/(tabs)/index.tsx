import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { useLibrary } from "@/contexts/LibraryContext";
import { useColors } from "@/hooks/useColors";
import {
  extractVideoId,
  formatViews,
  pipedChannel,
  pipedSearch,
  pipedSearchNextPage,
  pipedTrending,
  type PipedSearchItem,
  type PipedStreamItem,
  type SearchFilter,
} from "@/lib/piped";

interface Chip {
  key: string;
  label: string;
  query?: string;
  filter?: SearchFilter;
}

const CHIPS: Chip[] = [
  { key: "all", label: "All" },
  { key: "music", label: "Music", query: "music videos 2026", filter: "music_videos" },
  { key: "live", label: "Live", query: "live now", filter: "videos" },
  { key: "gaming", label: "Gaming", query: "gaming highlights 2026", filter: "videos" },
  { key: "news", label: "News", query: "news today", filter: "videos" },
  { key: "comedy", label: "Comedy", query: "comedy 2026", filter: "videos" },
  { key: "sports", label: "Sports", query: "sports highlights 2026", filter: "videos" },
  { key: "tech", label: "Tech", query: "tech review 2026", filter: "videos" },
  { key: "podcasts", label: "Podcasts", query: "podcast 2026", filter: "videos" },
  { key: "movies", label: "Movies", query: "movie trailer 2026", filter: "videos" },
  { key: "vlogs", label: "Vlogs", query: "vlog 2026", filter: "videos" },
];

const REGIONS = ["BD", "US", "IN", "GB"] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface NextToken {
  kind: "search";
  q: string;
  token: string | null;
  filter: SearchFilter;
}
interface PageData {
  items: PipedStreamItem[];
  nextpage: NextToken | null;
}

type FeedRow =
  | { kind: "video"; item: PipedStreamItem }
  | { kind: "shorts-shelf"; items: PipedStreamItem[] };

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history } = useLibrary();
  const [chip, setChip] = useState<Chip>(CHIPS[0]);
  const [seed, setSeed] = useState<number>(Date.now());

  // Pull videos from top-3 watched channels for "more like this"
  const topChannels = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string }[] = [];
    for (const h of history) {
      if (!h.channelId || seen.has(h.channelId)) continue;
      seen.add(h.channelId);
      list.push({ id: h.channelId });
      if (list.length >= 3) break;
    }
    return list;
  }, [history]);

  const channelQueries = useQueries({
    queries: topChannels.map((c) => ({
      queryKey: ["home-channel", c.id],
      queryFn: () => pipedChannel(c.id),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const recommendations = useMemo<PipedStreamItem[]>(() => {
    return channelQueries.flatMap((q) => q.data?.relatedStreams ?? []).slice(0, 18);
  }, [channelQueries]);

  // Shorts shelf for "All" feed
  const shortsShelf = useQuery({
    queryKey: ["home-shorts-shelf"],
    queryFn: async () => {
      const seeds = ["shorts viral", "funny shorts", "music shorts"];
      const pick = shuffle(seeds).slice(0, 2);
      const [trending, ...searches] = await Promise.all([
        Promise.allSettled(REGIONS.map((r) => pipedTrending(r))),
        ...pick.map((q) => pipedSearch(q, "videos").catch(() => null)),
      ]);
      const fromTrending = trending
        .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        .filter((v) => (v as { isShort?: boolean }).isShort || (v.duration > 0 && v.duration <= 60));
      const fromSearch = searches.flatMap((r) =>
        r ? (r.items ?? []).filter((i): i is PipedStreamItem => i.type === "stream" && i.duration > 0 && i.duration <= 60) : [],
      );
      const seen = new Set<string>();
      const out: PipedStreamItem[] = [];
      for (const it of [...shuffle(fromTrending), ...fromSearch]) {
        const id = extractVideoId(it.url);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(it);
        if (out.length >= 12) break;
      }
      return out;
    },
    staleTime: 1000 * 60 * 10,
    enabled: chip.key === "all",
  });

  const watchedSet = useMemo(() => new Set(history.map((h) => h.videoId)), [history]);

  const feed = useInfiniteQuery<PageData, Error, { pages: PageData[]; pageParams: (NextToken | null)[] }, ["home-feed", string, number], NextToken | null>({
    queryKey: ["home-feed", chip.key, seed],
    initialPageParam: null,
    queryFn: async ({ pageParam }): Promise<PageData> => {
      // Initial page (no token)
      if (!pageParam) {
        if (chip.key === "all") {
          const seedQueries = [
            "trending videos this week",
            "popular 2026",
            "viral video",
            "best moments 2026",
            "most viewed today",
          ];
          const picks = shuffle([...seedQueries]).slice(0, 3);
          const [searchResults, trendingResults] = await Promise.all([
            Promise.allSettled(picks.map((q) => pipedSearch(q, "videos"))),
            Promise.allSettled(REGIONS.map((r) => pipedTrending(r))),
          ]);
          const fromSearch = searchResults.flatMap((r) =>
            r.status === "fulfilled"
              ? (r.value.items ?? []).filter((i): i is PipedStreamItem => i.type === "stream" && i.duration > 60)
              : [],
          );
          const fromTrending = trendingResults
            .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
            .filter((v) => v.duration > 60 && !(v as { isShort?: boolean }).isShort);
          const nextSeed = picks[0];
          const merged = dedupe(
            [...recommendations, ...shuffle([...fromTrending, ...fromSearch])],
            watchedSet,
          );
          return {
            items: merged,
            nextpage: { kind: "search", q: nextSeed, token: null, filter: "videos" },
          };
        }
        // Specific category: search + nextpage
        const r = await pipedSearch(chip.query!, chip.filter ?? "videos");
        const items = (r.items ?? [])
          .filter((i): i is PipedStreamItem => i.type === "stream")
          .filter((v) => chip.key === "live" || v.duration > 0);
        return {
          items: dedupe(items, watchedSet),
          nextpage: r.nextpage
            ? { kind: "search", q: chip.query!, token: r.nextpage, filter: chip.filter ?? "videos" }
            : null,
        };
      }
      // Subsequent pages: paginate via search
      const r = pageParam.token
        ? await pipedSearchNextPage(pageParam.q, pageParam.token, pageParam.filter)
        : await pipedSearch(pageParam.q, pageParam.filter);
      const items = (r.items ?? [])
        .filter((i): i is PipedStreamItem => i.type === "stream")
        .filter((v) => chip.key === "live" || v.duration > 0);
      return {
        items: dedupe(items, watchedSet),
        nextpage: r.nextpage
          ? { kind: "search", q: pageParam.q, token: r.nextpage, filter: pageParam.filter }
          : null,
      };
    },
    getNextPageParam: (last) => last.nextpage ?? undefined,
  });

  const allItems = useMemo<PipedStreamItem[]>(() => {
    const out: PipedStreamItem[] = [];
    const seen = new Set<string>();
    for (const page of feed.data?.pages ?? []) {
      for (const it of page.items) {
        const id = extractVideoId(it.url);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(it);
      }
    }
    return out;
  }, [feed.data]);

  // Build rows: every ~6 videos, inject a Shorts shelf if available (only for All)
  const rows = useMemo<FeedRow[]>(() => {
    const result: FeedRow[] = [];
    const shorts = shortsShelf.data ?? [];
    if (chip.key === "all" && shorts.length > 0) {
      for (let i = 0; i < allItems.length; i++) {
        result.push({ kind: "video", item: allItems[i] });
        // Inject shelf after the 4th video
        if (i === 3) result.push({ kind: "shorts-shelf", items: shorts });
      }
    } else {
      for (const it of allItems) result.push({ kind: "video", item: it });
    }
    return result;
  }, [allItems, shortsShelf.data, chip.key]);

  const onRefresh = () => {
    setSeed(Date.now());
    shortsShelf.refetch();
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={styles.topBar}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Feather name="play" size={11} color="#fff" />
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>Nixo</Text>
        <View style={{ flex: 1 }}>
          <SearchBar />
        </View>
        <Pressable hitSlop={10} onPress={() => router.push("/(tabs)/files")} style={styles.iconBtn}>
          <Feather name="bookmark" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row, idx) =>
          row.kind === "video" ? `${extractVideoId(row.item.url)}-${idx}` : `shelf-${idx}`
        }
        renderItem={({ item }) =>
          item.kind === "video" ? (
            <VideoCard item={item.item} variant="feed" />
          ) : (
            <ShortsShelf items={item.items} colors={colors} />
          )
        }
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <FlatList
            data={CHIPS}
            keyExtractor={(c) => c.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item }) => {
              const active = chip.key === item.key;
              return (
                <Pressable
                  onPress={() => setChip(item)}
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
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : feed.isError ? (
            <View style={styles.center}>
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                Couldn&apos;t load. Pull to refresh.
              </Text>
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No videos.</Text>
          )
        }
      />
    </View>
  );
}

function ShortsShelf({ items, colors }: { items: PipedStreamItem[]; colors: ReturnType<typeof useColors> }) {
  const router = useRouter();
  return (
    <View style={shelfStyles.wrap}>
      <View style={shelfStyles.header}>
        <View style={[shelfStyles.iconBubble, { backgroundColor: "#E53935" }]}>
          <Feather name="play" size={12} color="#fff" />
        </View>
        <Text style={[shelfStyles.title, { color: colors.foreground }]}>Shorts</Text>
        <View style={{ flex: 1 }} />
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(it) => extractVideoId(it.url)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={shelfStyles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/shorts?start=${extractVideoId(item.url)}`)}
            style={shelfStyles.card}
          >
            <View style={shelfStyles.thumbWrap}>
              <Image source={{ uri: item.thumbnail }} style={shelfStyles.thumb} contentFit="cover" />
              <View style={shelfStyles.gradient} />
              <Text numberOfLines={2} style={shelfStyles.thumbTitle}>
                {item.title}
              </Text>
              <Text style={shelfStyles.thumbViews} numberOfLines={1}>
                {formatViews(item.views)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function dedupe(items: PipedSearchItem[] | PipedStreamItem[], watched: Set<string>): PipedStreamItem[] {
  const out: PipedStreamItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (it.type !== "stream") continue;
    const id = extractVideoId(it.url);
    if (!id || seen.has(id) || watched.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 6, paddingTop: 4 },
  logoMark: { width: 22, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  iconBtn: { padding: 6 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  center: { padding: 60, alignItems: "center" },
  footer: { padding: 24, alignItems: "center" },
  empty: { padding: 24, textAlign: "center", fontFamily: "Inter_400Regular" },
});

const shelfStyles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 12, marginVertical: 6, borderTopWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  iconBubble: { width: 22, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 8, gap: 8 },
  card: { width: 160, marginRight: 8 },
  thumbWrap: {
    width: 160,
    aspectRatio: 9 / 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },
  gradient: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  thumbTitle: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 22,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 15,
  },
  thumbViews: {
    position: "absolute",
    left: 8,
    bottom: 6,
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
