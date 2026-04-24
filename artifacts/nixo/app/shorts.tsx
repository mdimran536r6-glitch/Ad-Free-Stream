import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import {
  extractVideoId,
  formatViews,
  mediaProxy,
  pickVideoStream,
  pipedSearch,
  pipedStream,
  pipedTrending,
  type PipedStreamItem,
} from "@/lib/piped";

const REGIONS = ["BD", "US", "IN", "GB"] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchShorts(): Promise<PipedStreamItem[]> {
  const seeds = ["shorts viral", "funny shorts", "music shorts", "comedy shorts"];
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
  // Dedup
  const seen = new Set<string>();
  const out: PipedStreamItem[] = [];
  for (const it of [...shuffle(fromTrending), ...fromSearch]) {
    const id = extractVideoId(it.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

export default function ShortsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { start } = useLocalSearchParams<{ start?: string }>();

  const { height: winH, width: winW } = Dimensions.get("window");
  const pageH = winH;

  const list = useQuery({
    queryKey: ["shorts-feed"],
    queryFn: fetchShorts,
    staleTime: 1000 * 60 * 5,
  });

  // If start id is provided, ensure it's first
  const items = useMemo<PipedStreamItem[]>(() => {
    const data = list.data ?? [];
    if (!start) return data;
    const found = data.find((i) => extractVideoId(i.url) === start);
    if (found) {
      return [found, ...data.filter((i) => extractVideoId(i.url) !== start)];
    }
    // start id not in list — synthesize a placeholder so it plays first
    return [
      {
        url: `/watch?v=${start}`,
        type: "stream",
        title: "",
        thumbnail: "",
        uploaderName: "",
        duration: 0,
        views: 0,
      } as PipedStreamItem,
      ...data,
    ];
  }, [list.data, start]);

  const [activeIndex, setActiveIndex] = useState(0);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && typeof viewableItems[0].index === "number") {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  if (list.isLoading) {
    return (
      <View style={[styles.full, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: "#000" }]}>
      <FlatList
        data={items}
        keyExtractor={(it, i) => `${extractVideoId(it.url)}-${i}`}
        pagingEnabled
        snapToInterval={pageH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewConfig}
        renderItem={({ item, index }) => (
          <ShortItem
            item={item}
            active={index === activeIndex}
            height={pageH}
            width={winW}
            insetsTop={insets.top}
          />
        )}
      />

      <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.closeBtn, { top: insets.top + 8 }]}>
        <Feather name="x" size={26} color="#fff" />
      </Pressable>
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Text style={styles.headerText}>Shorts</Text>
      </View>
    </View>
  );
}

interface ShortItemProps {
  item: PipedStreamItem;
  active: boolean;
  height: number;
  width: number;
  insetsTop: number;
}

function ShortItem({ item, active, height, width }: ShortItemProps) {
  const id = extractVideoId(item.url);
  const colors = useColors();
  const router = useRouter();
  const { play } = usePlayer();
  const { isSaved, save, remove } = useLibrary();
  const [liked, setLiked] = useState(false);

  const stream = useQuery({
    queryKey: ["short-stream", id],
    queryFn: () => pipedStream(id),
    enabled: !!id && active,
    staleTime: 1000 * 60 * 30,
  });

  const data = stream.data;

  const sourceUri = useMemo(() => {
    if (!data) return null;
    // Prefer 480p or smaller progressive stream for shorts
    const v = pickVideoStream(data.videoStreams ?? [], 480);
    if (v?.url) return mediaProxy(v.url, v.mimeType);
    if (data.hls) return mediaProxy(data.hls);
    return null;
  }, [data]);

  const player = useVideoPlayer(sourceUri ?? null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!sourceUri) return;
    if (active) {
      try {
        player.play();
      } catch {}
    } else {
      try {
        player.pause();
      } catch {}
    }
  }, [active, sourceUri, player]);

  const title = data?.title ?? item.title;
  const uploader = data?.uploader ?? item.uploaderName;
  const avatar = data?.uploaderAvatar ?? item.uploaderAvatar ?? "";
  const views = data?.views ?? item.views;
  const saved = isSaved(id);

  const onShare = async () => {
    try {
      await Share.share({
        message: `${title}\nhttps://youtu.be/${id}`,
        url: `https://youtu.be/${id}`,
        title,
      });
    } catch {}
  };

  return (
    <View style={[styles.page, { height, width }]}>
      <View style={styles.videoWrap}>
        {sourceUri ? (
          <Pressable onPress={() => (player.playing ? player.pause() : player.play())} style={StyleSheet.absoluteFill}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />
          </Pressable>
        ) : (
          <Image
            source={{ uri: item.thumbnail || data?.thumbnailUrl || "" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}
        {!sourceUri && (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>

      {/* Right action column */}
      <View style={[styles.rightCol, { paddingBottom: 90 }]}>
        <Pressable
          hitSlop={10}
          onPress={() => router.push(`/channel/${item.uploaderUrl ? extractChannelOnly(item.uploaderUrl) : (data?.uploaderUrl ?? "")}`)}
          style={styles.avatarBtn}
        >
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          <View style={styles.subDot}>
            <Feather name="plus" size={12} color="#fff" />
          </View>
        </Pressable>

        <ActionBtn
          icon={liked ? "heart" : "heart"}
          color={liked ? "#ff2d55" : "#fff"}
          label={data?.likes ? compactNum(data.likes) : "Like"}
          onPress={() => setLiked((v) => !v)}
        />
        <ActionBtn
          icon="message-circle"
          color="#fff"
          label="Comments"
          onPress={() => router.push(`/video/${id}`)}
        />
        <ActionBtn
          icon={saved ? "bookmark" : "bookmark"}
          color={saved ? colors.primary : "#fff"}
          label={saved ? "Saved" : "Save"}
          onPress={async () => {
            if (saved) await remove(id);
            else
              await save({
                videoId: id,
                title: title || "",
                artist: uploader || "",
                thumbnail: item.thumbnail || data?.thumbnailUrl || "",
                duration: item.duration,
                kind: "video",
              });
          }}
        />
        <ActionBtn icon="share-2" color="#fff" label="Share" onPress={onShare} />
        <ActionBtn
          icon="headphones"
          color="#fff"
          label="Audio"
          onPress={() => {
            player.pause();
            play({
              videoId: id,
              title: title || "",
              artist: uploader || "",
              thumbnail: item.thumbnail || data?.thumbnailUrl || "",
            });
          }}
        />
      </View>

      {/* Bottom meta */}
      <View style={[styles.bottom, { paddingBottom: 90 }]}>
        <View style={styles.bottomRow}>
          <Text style={styles.bottomChannel} numberOfLines={1}>
            @{(uploader || "").replace(/\s+/g, "").toLowerCase() || "channel"}
          </Text>
        </View>
        <Text style={styles.bottomTitle} numberOfLines={2}>
          {title}
        </Text>
        {views > 0 ? (
          <Text style={styles.bottomViews}>{formatViews(views)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.actionBtn}>
      <Feather name={icon} size={28} color={color} />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractChannelOnly(url: string): string {
  if (url.startsWith("/channel/")) return url.replace("/channel/", "");
  const m = url.match(/\/channel\/([\w-]+)/);
  return m ? m[1] : url;
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: "center", justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  headerText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  page: { backgroundColor: "#000", position: "relative" },
  videoWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  rightCol: {
    position: "absolute",
    right: 8,
    bottom: 0,
    alignItems: "center",
    gap: 18,
  },
  avatarBtn: { alignItems: "center", marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#fff", backgroundColor: "#222" },
  subDot: {
    position: "absolute",
    bottom: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: { alignItems: "center", gap: 4, paddingHorizontal: 4 },
  actionLabel: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  bottom: {
    position: "absolute",
    left: 14,
    right: 80,
    bottom: 0,
  },
  bottomRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  bottomChannel: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  bottomTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 18 },
  bottomViews: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
});
