import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";

export function MiniPlayer() {
  const { current, isPlaying, isLoading, toggle, stop, position, duration } = usePlayer();
  const colors = useColors();
  const router = useRouter();
  if (!current) return null;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <Pressable
      onPress={() => router.push("/player")}
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.progress, { width: `${progress}%`, backgroundColor: colors.primary }]} />
      <Image source={{ uri: current.thumbnail }} style={styles.thumb} contentFit="cover" />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
          {current.title}
        </Text>
        <Text numberOfLines={1} style={[styles.artist, { color: colors.mutedForeground }]}>
          {current.artist}
        </Text>
      </View>
      <Pressable hitSlop={10} onPress={toggle} style={styles.btn}>
        {isLoading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Feather name={isPlaying ? "pause" : "play"} size={22} color={colors.foreground} />
        )}
      </Pressable>
      <Pressable hitSlop={10} onPress={stop} style={styles.btn}>
        <Feather name="x" size={20} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  progress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  meta: { flex: 1 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  artist: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  btn: { padding: 8 },
});
