import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNav } from "@/components/BottomNav";
import { VideoActionSheet } from "@/components/VideoActionSheet";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useColors } from "@/hooks/useColors";
import { downloadMedia } from "@/lib/downloads";
import { bestAudio, extractVideoId, formatDuration, pipedPlaylist, pipedStream, type PipedStreamItem } from "@/lib/piped";

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const { addDownload } = useLibrary();
  const [menu, setMenu] = React.useState<PipedStreamItem | null>(null);
  const [bulk, setBulk] = React.useState<{ done: number; total: number; current: string } | null>(null);

  const q = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => pipedPlaylist(id!),
    enabled: !!id,
  });

  const downloadAll = React.useCallback(async () => {
    const items = q.data?.relatedStreams ?? [];
    if (!items.length) return;
    setBulk({ done: 0, total: items.length, current: "" });
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setBulk({ done: i, total: items.length, current: it.title });
      try {
        const vid = extractVideoId(it.url);
        const det = await pipedStream(vid);
        const a = bestAudio(det.audioStreams);
        if (!a) continue;
        const fmt: "m4a" | "webm" = a.mimeType?.includes("mp4") ? "m4a" : "webm";
        const res = await downloadMedia(a.url, `${it.title} - ${it.uploaderName}`, fmt);
        await addDownload({
          videoId: vid,
          title: it.title,
          artist: it.uploaderName,
          thumbnail: it.thumbnail,
          duration: it.duration,
          format: fmt,
          localUri: res.uri,
          size: res.size,
        });
      } catch {
        /* skip */
      }
    }
    setBulk(null);
  }, [q.data, addDownload]);

  if (!id) return null;
  const data = q.data;

  const Header = data ? (
    <View style={styles.header}>
      <Image source={{ uri: data.thumbnailUrl }} style={styles.cover} contentFit="cover" />
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {data.name}
      </Text>
      <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
        {data.uploader} · {data.videos} songs
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => {
            const first = data.relatedStreams?.[0];
            if (!first) return;
            play({
              videoId: extractVideoId(first.url),
              title: first.title,
              artist: first.uploaderName,
              thumbnail: first.thumbnail,
            });
          }}
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="play" size={16} color="#fff" />
          <Text style={styles.playText}>Play</Text>
        </Pressable>
        <Pressable
          disabled={!!bulk}
          onPress={downloadAll}
          style={[styles.playBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="download" size={16} color={colors.foreground} />
          <Text style={[styles.playText, { color: colors.foreground }]}>
            {bulk ? `${bulk.done}/${bulk.total}` : "Download all"}
          </Text>
        </Pressable>
      </View>
      {bulk ? (
        <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground, marginTop: 6 }]}>
          {bulk.current}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.topRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>
          {data?.name ?? "Playlist"}
        </Text>
      </View>
      {q.isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data.relatedStreams ?? []}
          keyExtractor={(it, i) => `${it.url}-${i}`}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 150 }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() =>
                play({
                  videoId: extractVideoId(item.url),
                  title: item.title,
                  artist: item.uploaderName,
                  thumbnail: item.thumbnail,
                })
              }
              style={styles.songRow}
            >
              <Text style={[styles.idx, { color: colors.mutedForeground }]}>{index + 1}</Text>
              <Image source={{ uri: item.thumbnail }} style={styles.songThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.songTitle, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={[styles.songSub, { color: colors.mutedForeground }]}>
                  {item.uploaderName} · {formatDuration(item.duration)}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setMenu(item)} style={{ paddingHorizontal: 8 }}>
                <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
      <BottomNav />
      {menu ? (
        <VideoActionSheet
          visible={!!menu}
          onClose={() => setMenu(null)}
          videoId={extractVideoId(menu.url)}
          title={menu.title}
          artist={menu.uploaderName}
          thumbnail={menu.thumbnail}
          duration={menu.duration}
          channelUrl={menu.uploaderUrl}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 4, gap: 6 },
  topTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  iconBtn: { padding: 10 },
  center: { padding: 60, alignItems: "center" },
  header: { alignItems: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 6 },
  cover: { width: 200, height: 200, borderRadius: 14, marginBottom: 10 },
  title: { fontSize: 19, fontFamily: "Inter_700Bold", textAlign: "center" },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  playBtn: {
    flexDirection: "row", gap: 8, alignItems: "center",
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, marginTop: 12,
  },
  playText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  songRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  idx: { width: 24, fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  songThumb: { width: 48, height: 48, borderRadius: 6 },
  songTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  songSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
