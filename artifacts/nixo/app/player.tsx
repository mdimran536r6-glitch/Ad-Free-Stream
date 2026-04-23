import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { formatDuration } from "@/lib/piped";

export default function PlayerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, isPlaying, isLoading, toggle, position, duration, seek } = usePlayer();
  const { isSaved, save, remove } = useLibrary();

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Nothing playing</Text>
      </View>
    );
  }

  const saved = isSaved(current.videoId);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={[styles.root, { backgroundColor: "#3a2624", paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#5a3a36", "#2a1d1c"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-down" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {current.artist}
        </Text>
        <Pressable hitSlop={10} style={styles.iconBtn}>
          <Feather name="share-2" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.artworkWrap}>
        <Image source={{ uri: current.thumbnail }} style={styles.artwork} contentFit="cover" />
      </View>

      <View style={styles.metaBox}>
        <Text style={styles.title} numberOfLines={2}>
          {current.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {current.artist}
        </Text>
      </View>

      <View style={styles.progressBox}>
        <Pressable
          style={styles.progressBar}
          onPress={(e) => {
            const x = e.nativeEvent.locationX;
            // simple proportional seek; bar width approximated to layout
            // (works best on touch devices; use measure for precision later)
            // we re-use 100% of available width
            seek(((x / 320) * duration) || 0);
          }}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatDuration(position)}</Text>
          <Text style={styles.time}>{formatDuration(duration)}</Text>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable hitSlop={10} style={styles.ctlSmall}>
          <Feather name="repeat" size={22} color="#fff" />
        </Pressable>
        <Pressable hitSlop={10} style={styles.ctlSmall} onPress={() => seek(Math.max(0, position - 10))}>
          <Feather name="skip-back" size={28} color="#fff" />
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={toggle}
          style={[styles.playBtn, { backgroundColor: "#fff" }]}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Feather name={isPlaying ? "pause" : "play"} size={32} color="#000" />
          )}
        </Pressable>
        <Pressable hitSlop={10} style={styles.ctlSmall} onPress={() => seek(position + 10)}>
          <Feather name="skip-forward" size={28} color="#fff" />
        </Pressable>
        <Pressable
          hitSlop={10}
          style={styles.ctlSmall}
          onPress={async () => {
            if (saved) await remove(current.videoId);
            else
              await save({
                videoId: current.videoId,
                title: current.title,
                artist: current.artist,
                thumbnail: current.thumbnail,
                duration,
                kind: "audio",
              });
          }}
        >
          <Feather name={saved ? "check-circle" : "download-cloud"} size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  iconBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: "#fff",
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  artworkWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 12,
  },
  artwork: { width: "100%", aspectRatio: 1, borderRadius: 16 },
  metaBox: { paddingHorizontal: 32, paddingTop: 24, gap: 6 },
  title: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  artist: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_500Medium" },
  progressBox: { paddingHorizontal: 32, paddingTop: 22 },
  progressBar: { paddingVertical: 8 },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  timeRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  ctlSmall: { padding: 12 },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
