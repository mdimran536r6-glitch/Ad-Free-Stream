import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { VideoCard } from "@/components/VideoCard";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import {
  extractChannelId,
  formatDuration,
  formatViews,
  pickVideoStream,
  pipedStream,
} from "@/lib/piped";

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const { recordWatch } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);

  const stream = useQuery({
    queryKey: ["stream", id],
    queryFn: () => pipedStream(id!),
    enabled: !!id,
  });

  const sourceUri = useMemo(() => {
    if (!stream.data) return null;
    if (stream.data.hls) return stream.data.hls;
    const v = pickVideoStream(stream.data.videoStreams ?? [], 480);
    return v?.url ?? null;
  }, [stream.data]);

  const player = useVideoPlayer(sourceUri ?? null, (p) => {
    p.loop = false;
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (data) {
              player.pause();
              play({ videoId: id, title: data.title, artist: data.uploader, thumbnail: data.thumbnailUrl });
            }
          }}
          style={styles.iconBtn}
        >
          <Feather name="headphones" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
          <Feather name="more-vertical" size={22} color={colors.foreground} />
        </Pressable>
      </View>

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
        <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
          <View style={styles.metaBox}>
            <Text style={[styles.title, { color: colors.foreground }]}>{data.title}</Text>
            <Text style={[styles.subMeta, { color: colors.mutedForeground }]}>
              {formatViews(data.views)} · {formatDuration(data.duration)}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(`/channel/${channelId}`)}
            style={[styles.channelRow, { borderColor: colors.border }]}
          >
            <Image source={{ uri: data.uploaderAvatar }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.channelName, { color: colors.foreground }]} numberOfLines={1}>
                {data.uploader}
              </Text>
              <Text style={[styles.channelSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {data.uploaderSubscriberCount >= 1000
                  ? `${(data.uploaderSubscriberCount / 1000).toFixed(0)}K subscribers`
                  : `${data.uploaderSubscriberCount} subscribers`}
              </Text>
            </View>
          </Pressable>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Up next</Text>
            {(data.relatedStreams ?? []).slice(0, 20).map((it) => (
              <VideoCard key={it.url} item={it} variant="feed" />
            ))}
          </View>
        </ScrollView>
      )}

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
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 4 },
  iconBtn: { padding: 10 },
  videoBox: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center", padding: 40 },
  metaBox: { padding: 16, gap: 6 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  subMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  channelName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  channelSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
});
