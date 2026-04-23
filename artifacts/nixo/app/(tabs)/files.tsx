import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary, type SavedItem } from "@/contexts/LibraryContext";
import { useColors } from "@/hooks/useColors";
import { formatDuration } from "@/lib/piped";

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, remove } = useLibrary();
  const { play } = usePlayer();
  const router = useRouter();
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Files</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {items.length} saved {items.length === 1 ? "item" : "items"}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.videoId}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : { paddingBottom: 200 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="download-cloud" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.foreground }]}>
              Nothing saved yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Tap the save icon on any track to keep it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            item={item}
            onPlay={() => {
              if (item.kind === "video") {
                router.push(`/video/${item.videoId}`);
              } else {
                play({
                  videoId: item.videoId,
                  title: item.title,
                  artist: item.artist,
                  thumbnail: item.thumbnail,
                });
              }
            }}
            onRemove={() => remove(item.videoId)}
          />
        )}
      />
    </View>
  );
}

function Row({ item, onPlay, onRemove }: { item: SavedItem; onPlay: () => void; onRemove: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.foreground }]}>
          {item.title}
        </Text>
        <Text style={[styles.itemMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.artist} · {formatDuration(item.duration)} · {item.kind === "audio" ? "Audio" : "Video"}
        </Text>
      </View>
      <Pressable hitSlop={10} onPress={onRemove} style={styles.btn}>
        <Feather name="trash-2" size={18} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  itemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  itemMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  btn: { padding: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280 },
});
