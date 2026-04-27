import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNav } from "@/components/BottomNav";
import { VideoActionSheet } from "@/components/VideoActionSheet";
import { VideoCard } from "@/components/VideoCard";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import {
  extractChannelId,
  extractVideoId,
  formatDuration,
  formatViews,
  mediaProxy,
  pickVideoStream,
  pipedSearch,
  pipedStream,
  timeAgo,
  type PipedStreamItem,
} from "@/lib/piped";

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const { recordWatch } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const stream = useQuery({
    queryKey: ["stream", id],
    queryFn: () => pipedStream(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

  // Fallback "Up next": when Piped doesn't return relatedStreams, search by title
  // so the section never sits empty.
  const fallbackUpNext = useQuery({
    queryKey: ["video-fallback-related", id, stream.data?.title ?? ""],
    queryFn: async () => {
      const t = stream.data?.title;
      if (!t) return [] as PipedStreamItem[];
      const r = await pipedSearch(t.slice(0, 80), "videos");
      return (r.items ?? []).filter(
        (i): i is PipedStreamItem => i.type === "stream" && extractVideoId(i.url) !== id,
      );
    },
    enabled: !!stream.data && (stream.data.relatedStreams ?? []).length === 0,
    staleTime: 1000 * 60 * 10,
  });

  const upNext = useMemo<PipedStreamItem[]>(() => {
    const fromStream = stream.data?.relatedStreams ?? [];
    if (fromStream.length > 0) return fromStream;
    return fallbackUpNext.data ?? [];
  }, [stream.data, fallbackUpNext.data]);

  const sourceUri = useMemo(() => {
    if (!stream.data) return null;
    const v = pickVideoStream(stream.data.videoStreams ?? [], 480);
    if (v?.url) return mediaProxy(v.url, v.mimeType);
    if (stream.data.hls) return mediaProxy(stream.data.hls);
    return null;
  }, [stream.data]);

  const player = useVideoPlayer(sourceUri ?? null, (p) => {
    p.loop = false;
    if (Platform.OS === "web") p.muted = true; // web autoplay policy
    p.play();
  });

  const data = stream.data;

  useEffect(() => {
    if (data && id) {
      recordWatch({
        videoId: id,
        title: data.title,
        thumbnail: data.thumbnailUrl,
        channelId: data.uploaderUrl ? extractChannelId(data.uploaderUrl) : undefined,
        channelName: data.uploader,
      });
    }
  }, [data, id, recordWatch]);

  if (!id) return null;
  const channelId = data ? extractChannelId(data.uploaderUrl ?? "") : "";
  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colors.background === "#000000" ? "light" : "dark"} />

      {/* Top action bar: back + title + headphones + 3-dot */}
      <View
        style={[
          styles.topBar,
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
        <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>
          Nixo
        </Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (data) {
              try {
                player.pause();
              } catch {}
              play({
                videoId: id,
                title: data.title,
                artist: data.uploader,
                thumbnail: data.thumbnailUrl,
              });
            }
          }}
          style={styles.iconBtn}
        >
          <Feather name="headphones" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
          <Feather name="more-vertical" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Video player area */}
      <View style={styles.videoBox}>
        {sourceUri ? (
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
        ) : data ? (
          <Image source={{ uri: data.thumbnailUrl }} style={styles.video} contentFit="cover" />
        ) : (
          <View style={[styles.video, styles.center]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>

      {stream.isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metaBox}>
            <Text style={[styles.title, { color: colors.foreground }]}>{data.title}</Text>
            <Text style={[styles.subMeta, { color: colors.mutedForeground }]}>
              {formatViews(data.views)} · {timeAgo(data.uploadDate)} · {formatDuration(data.duration)}
            </Text>
          </View>

          <View style={[styles.channelRow, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => {
                if (!channelId) return;
                router.push({
                  pathname: "/channel/[id]",
                  params: {
                    id: channelId,
                    name: data.uploader ?? "",
                    subs: String(data.uploaderSubscriberCount ?? ""),
                    avatar: data.uploaderAvatar ?? "",
                    mode: "video",
                  },
                });
              }}
              style={styles.channelLeft}
            >
              <Image source={{ uri: data.uploaderAvatar }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.channelName, { color: colors.foreground }]} numberOfLines={1}>
                  {data.uploader}
                </Text>
                <Text style={[styles.channelSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {data.uploaderSubscriberCount > 0
                    ? data.uploaderSubscriberCount >= 1_000_000
                      ? `${(data.uploaderSubscriberCount / 1_000_000).toFixed(1)}M subscribers`
                      : data.uploaderSubscriberCount >= 1_000
                      ? `${(data.uploaderSubscriberCount / 1_000).toFixed(1)}K subscribers`
                      : `${data.uploaderSubscriberCount} subscribers`
                    : ""}
                </Text>
              </View>
            </Pressable>
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
                {subscribed ? "Subscribed" : "Subscribe"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Up next</Text>
            {upNext.length === 0 && fallbackUpNext.isLoading ? (
              <View style={[styles.center, { paddingVertical: 24 }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : upNext.length === 0 ? (
              <Text style={[styles.subMeta, { color: colors.mutedForeground, paddingHorizontal: 12 }]}>
                No suggestions available.
              </Text>
            ) : (
              upNext.slice(0, 20).map((it) => (
                <VideoCard key={it.url} item={it} variant="feed" />
              ))
            )}
          </View>
        </ScrollView>
      )}

      <BottomNav />

      {data ? (
        <VideoActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          videoId={id}
          title={data.title}
          artist={data.uploader}
          thumbnail={data.thumbnailUrl}
          duration={data.duration}
          channelUrl={data.uploaderUrl}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  iconBtn: { padding: 10 },
  topTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginLeft: 4 },
  videoBox: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center", padding: 40 },
  metaBox: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 6 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 22 },
  subMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 12,
  },
  channelLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  channelName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  channelSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  subBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  subBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
});
