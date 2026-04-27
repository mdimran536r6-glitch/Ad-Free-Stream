import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";

export function MiniPlayer() {
  const {
    current,
    isPlaying,
    isLoading,
    toggle,
    stop,
    position,
    duration,
    next,
    hasNext,
  } = usePlayer();
  const colors = useColors();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
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
      <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); toggle(); }} style={styles.btn}>
        {isLoading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Feather name={isPlaying ? "pause" : "play"} size={22} color={colors.foreground} />
        )}
      </Pressable>
      <Pressable
        hitSlop={10}
        onPress={(e) => { e.stopPropagation(); next(); }}
        style={[styles.btn, !hasNext && { opacity: 0.35 }]}
      >
        <Feather name="skip-forward" size={20} color={colors.foreground} />
      </Pressable>
      <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); setMenu(true); }} style={styles.btn}>
        <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
      </Pressable>
      <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); stop(); }} style={styles.btn}>
        <Feather name="x" size={18} color={colors.mutedForeground} />
      </Pressable>
      <VideoActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        videoId={current.videoId}
        title={current.title}
        artist={current.artist}
        thumbnail={current.thumbnail}
        duration={duration}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  meta: { flex: 1, paddingHorizontal: 4 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  artist: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  btn: { padding: 6 },
});
