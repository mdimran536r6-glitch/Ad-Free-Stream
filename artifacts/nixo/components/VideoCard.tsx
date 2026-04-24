import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { useColors } from "@/hooks/useColors";
import { extractVideoId, formatDuration, formatViews, timeAgo, type PipedStreamItem } from "@/lib/piped";

interface Props {
  item: PipedStreamItem;
  variant?: "list" | "grid" | "feed" | "short";
}

export function VideoCard({ item, variant = "feed" }: Props) {
  const colors = useColors();
  const router = useRouter();
  const id = extractVideoId(item.url);
  const [menuOpen, setMenuOpen] = useState(false);

  const sheet = (
    <VideoActionSheet
      visible={menuOpen}
      onClose={() => setMenuOpen(false)}
      videoId={id}
      title={item.title}
      artist={item.uploaderName}
      thumbnail={item.thumbnail}
      duration={item.duration}
      channelUrl={item.uploaderUrl}
    />
  );

  if (variant === "short") {
    return (
      <>
        <Pressable
          onPress={() => router.push(`/shorts?start=${id}`)}
          style={({ pressed }) => [styles.shortCard, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={styles.shortThumbWrap}>
            <Image source={{ uri: item.thumbnail }} style={styles.shortThumb} contentFit="cover" />
            <View style={styles.shortGradient} />
            <Text numberOfLines={2} style={styles.shortTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.shortViews}>
              {formatViews(item.views)}
            </Text>
          </View>
        </Pressable>
        {sheet}
      </>
    );
  }

  if (variant === "grid") {
    return (
      <>
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
            {item.uploadedDate ? ` · ${timeAgo(item.uploadedDate)}` : ""}
          </Text>
        </Pressable>
        {sheet}
      </>
    );
  }

  if (variant === "list") {
    return (
      <>
        <Pressable
          onPress={() => router.push(`/video/${id}`)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={styles.rowThumbWrap}>
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
              {item.uploaderName} · {formatViews(item.views)}
              {item.uploadedDate ? ` · ${timeAgo(item.uploadedDate)}` : ""}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); setMenuOpen(true); }} style={styles.iconBtn}>
            <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
          </Pressable>
        </Pressable>
        {sheet}
      </>
    );
  }

  // feed (YouTube style — full width)
  return (
    <>
      <Pressable
        onPress={() => router.push(`/video/${id}`)}
        style={({ pressed }) => [styles.feedCard, { opacity: pressed ? 0.95 : 1 }]}
      >
        <View style={styles.feedThumbWrap}>
          <Image source={{ uri: item.thumbnail }} style={styles.feedThumb} contentFit="cover" />
          {item.duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
            </View>
          )}
        </View>
        <View style={styles.feedMetaRow}>
          {item.uploaderAvatar ? (
            <Image source={{ uri: item.uploaderAvatar }} style={styles.feedAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.feedAvatar, { backgroundColor: colors.muted }]} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={[styles.feedTitle, { color: colors.foreground }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={[styles.feedSub, { color: colors.mutedForeground }]}>
              {item.uploaderName} · {formatViews(item.views)}
              {item.uploadedDate ? ` · ${timeAgo(item.uploadedDate)}` : ""}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); setMenuOpen(true); }} style={styles.iconBtn}>
            <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </Pressable>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  // list (compact)
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, gap: 10, alignItems: "center" },
  rowThumbWrap: { width: 140, height: 80, borderRadius: 10, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  uploader: { fontSize: 11, fontFamily: "Inter_400Regular" },
  iconBtn: { padding: 6 },

  // grid
  gridCard: { width: 200, gap: 6 },
  gridThumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden" },
  gridThumb: { width: "100%", height: "100%" },
  gridTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 6 },

  // feed (YouTube-style)
  feedCard: { marginBottom: 14 },
  feedThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  feedThumb: { width: "100%", height: "100%" },
  feedMetaRow: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, gap: 10, alignItems: "flex-start" },
  feedAvatar: { width: 36, height: 36, borderRadius: 18 },
  feedTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  feedSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  durationBadge: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  durationText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },

  // shorts (vertical tile)
  shortCard: { width: 160, marginRight: 10 },
  shortThumbWrap: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  shortThumb: { width: "100%", height: "100%" },
  shortGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  shortTitle: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 22,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 15,
  },
  shortViews: {
    position: "absolute",
    left: 8,
    bottom: 6,
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
