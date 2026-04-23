import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { extractVideoId, formatDuration, formatViews, type PipedStreamItem } from "@/lib/piped";

interface Props {
  item: PipedStreamItem;
  variant?: "list" | "grid";
}

export function VideoCard({ item, variant = "list" }: Props) {
  const colors = useColors();
  const router = useRouter();
  const id = extractVideoId(item.url);

  if (variant === "grid") {
    return (
      <Pressable
        onPress={() => router.push(`/video/${id}`)}
        style={({ pressed }) => [styles.gridCard, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.gridThumbWrap}>
          <Image source={{ uri: item.thumbnail }} style={styles.gridThumb} contentFit="cover" />
          {item.duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={[styles.gridTitle, { color: colors.foreground }]}>
          {item.title}
        </Text>
        <Text style={[styles.uploader, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.uploaderName}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/video/${id}`)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.thumbWrap}>
        <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
        {item.duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.uploader, { color: colors.mutedForeground }]}>
          {item.uploaderName}
        </Text>
        <Text numberOfLines={1} style={[styles.uploader, { color: colors.mutedForeground }]}>
          {formatViews(item.views)}
        </Text>
      </View>
      <Pressable
        hitSlop={10}
        onPress={(e) => {
          e.stopPropagation();
          router.push(`/video/${id}`);
        }}
        style={styles.iconBtn}
      >
        <Feather name="download" size={20} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: "center",
  },
  thumbWrap: { width: 120, height: 72, borderRadius: 8, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  uploader: { fontSize: 12, fontFamily: "Inter_400Regular" },
  iconBtn: { padding: 8 },
  gridCard: { width: 200, gap: 6 },
  gridThumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden" },
  gridThumb: { width: "100%", height: "100%" },
  gridTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
});
