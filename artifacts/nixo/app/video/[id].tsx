import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { save, remove, isSaved } = useLibrary();

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

  if (!id) return null;

  const data = stream.data;
  const channelId = data ? extractChannelId(data.uploaderUrl ?? "") : "";
  const saved = isSaved(id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.videoBox}>
        {sourceUri ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
          />
        ) : data ? (
          <Image source={{ uri: data.thumbnailUrl }} style={styles.video} contentFit="cover" />
        ) : (
          <View style={[styles.video, styles.center]}>
            <ActivityIndicator color={colors.primaryForeground} />
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
            <Pressable
              style={[styles.subBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/channel/${channelId}`)}
            >
              <Text style={[styles.subBtnText, { color: colors.primaryForeground }]}>VISIT</Text>
            </Pressable>
          </Pressable>

          <View style={styles.actionRow}>
            <ActionBtn
              icon="headphones"
              label="Audio"
              onPress={() => {
                player.pause();
                play({
                  videoId: id,
                  title: data.title,
                  artist: data.uploader,
                  thumbnail: data.thumbnailUrl,
                });
              }}
            />
            <ActionBtn
              icon={saved ? "check" : "download"}
              label={saved ? "Saved" : "Save"}
              onPress={async () => {
                if (saved) {
                  await remove(id);
                } else {
                  await save({
                    videoId: id,
                    title: data.title,
                    artist: data.uploader,
                    thumbnail: data.thumbnailUrl,
                    duration: data.duration,
                    kind: "video",
                  });
                }
              }}
            />
            <ActionBtn icon="share-2" label="Share" onPress={() => {}} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Up next</Text>
            {(data.relatedStreams ?? []).slice(0, 20).map((it) => (
              <VideoCard key={it.url} item={it} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: colors.secondary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Feather name={icon} size={16} color={colors.foreground} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 6 },
  iconBtn: { padding: 8 },
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
  subBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  subBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
});
