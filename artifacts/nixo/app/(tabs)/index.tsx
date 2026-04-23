import { Feather } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
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
  extractChannelId,
  pipedChannel,
  pipedSearch,
  pipedTrending,
  type PipedStreamItem,
} from "@/lib/piped";

const CHIPS = ["All", "Music", "Live", "Gaming", "News", "Comedy", "Sports", "Tech"];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history } = useLibrary();
  const [chip, setChip] = useState<string>("All");

  const trendingBD = useQuery({
    queryKey: ["trending", "BD"],
    queryFn: () => pipedTrending("BD"),
  });
  const trendingUS = useQuery({
    queryKey: ["trending", "US"],
    queryFn: () => pipedTrending("US"),
  });

  const topChannels = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const h of history) {
      if (!h.channelId || seen.has(h.channelId)) continue;
      seen.add(h.channelId);
      list.push({ id: h.channelId, name: h.channelName ?? "" });
      if (list.length >= 3) break;
    }
    return list;
  }, [history]);

  const channelQueries = useQueries({
    queries: topChannels.map((c) => ({
      queryKey: ["channel-feed", c.id],
      queryFn: () => pipedChannel(c.id),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const chipQuery = useQuery({
    queryKey: ["chip-search", chip],
    queryFn: () => pipedSearch(chip, "videos"),
    enabled: chip !== "All",
  });

  const feed = useMemo<PipedStreamItem[]>(() => {
    if (chip !== "All") {
      const items = (chipQuery.data?.items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[];
      return items;
    }
    const recommended: PipedStreamItem[] = channelQueries
      .flatMap((q) => q.data?.relatedStreams ?? [])
      .slice(0, 12);
    const trend = [...(trendingBD.data ?? []), ...(trendingUS.data ?? [])];
    const merged: PipedStreamItem[] = [];
    const ids = new Set<string>();
    const watchedIds = new Set(history.map((h) => h.videoId));

    // Interleave: 1 recommended, 2 trending
    let r = 0;
    let t = 0;
    while (r < recommended.length || t < trend.length) {
      if (r < recommended.length) {
        const it = recommended[r++];
        const id = (it.url || "").split("v=")[1]?.split("&")[0] ?? it.url;
        if (!ids.has(id) && !watchedIds.has(id)) {
          ids.add(id);
          merged.push(it);
        }
      }
      for (let i = 0; i < 2 && t < trend.length; i++) {
        const it = trend[t++];
        const id = (it.url || "").split("v=")[1]?.split("&")[0] ?? it.url;
        if (!ids.has(id) && !watchedIds.has(id)) {
          ids.add(id);
          merged.push(it);
        }
      }
    }
    // shuffle slightly to feel "random"
    return merged;
  }, [chip, chipQuery.data, channelQueries, trendingBD.data, trendingUS.data, history]);

  const isLoading =
    chip === "All"
      ? trendingBD.isLoading && trendingUS.isLoading
      : chipQuery.isLoading;

  const onRefresh = () => {
    if (chip === "All") {
      trendingBD.refetch();
      trendingUS.refetch();
      channelQueries.forEach((q) => q.refetch());
    } else {
      chipQuery.refetch();
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={styles.topBar}>
        <Text style={[styles.brand, { color: colors.primary }]}>Nixo</Text>
        <View style={{ flex: 1 }}>
          <SearchBar />
        </View>
        <Pressable hitSlop={10} onPress={() => router.push("/(tabs)/files")} style={styles.iconBtn}>
          <Feather name="user" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item, idx) => `${item.url}-${idx}`}
        renderItem={({ item }) => <VideoCard item={item} variant="feed" />}
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <FlatList
            data={CHIPS}
            keyExtractor={(c) => c}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item }) => {
              const active = chip === item;
              return (
                <Pressable
                  onPress={() => setChip(item)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.foreground : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.background : colors.foreground },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No videos.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  brand: { fontSize: 20, fontFamily: "Inter_700Bold" },
  iconBtn: { padding: 6 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  center: { padding: 60, alignItems: "center" },
  empty: { padding: 24, textAlign: "center", fontFamily: "Inter_400Regular" },
});
