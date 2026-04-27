import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer, type NowPlaying } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { formatDuration } from "@/lib/piped";

export default function PlayerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    current,
    isPlaying,
    isLoading,
    toggle,
    position,
    duration,
    seek,
    upNext,
    history,
    queueIndex,
    hasNext,
    hasPrevious,
    next,
    previous,
    playAt,
  } = usePlayer();
  const { isSaved, save, remove } = useLibrary();
  const [menu, setMenu] = useState(false);

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Nothing playing</Text>
      </View>
    );
  }

  const saved = isSaved(current.videoId);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Soft tinted backdrop using the artwork */}
      <Image
        source={{ uri: current.thumbnail }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={50}
      />
      <LinearGradient
        colors={[
          colors.background === "#FFFFFF" || colors.background === "#ffffff"
            ? "rgba(255,255,255,0.55)"
            : "rgba(0,0,0,0.45)",
          colors.background,
        ]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top: minimize chevron + brand + menu */}
        <View style={[styles.headerRow, { paddingTop: topPad + 4 }]}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="chevron-down" size={26} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>NOW PLAYING</Text>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {current.artist || "Music"}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={() => setMenu(true)} style={styles.iconBtn}>
            <Feather name="more-vertical" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.artworkWrap}>
          <Image source={{ uri: current.thumbnail }} style={styles.artwork} contentFit="cover" />
        </View>

        <View style={styles.metaBox}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {current.title}
          </Text>
          <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {current.artist}
          </Text>
        </View>

        <View style={styles.progressBox}>
          <Pressable
            style={styles.progressBar}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              seek(((x / 320) * duration) || 0);
            }}
          >
            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.foreground },
                ]}
              />
            </View>
          </Pressable>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatDuration(position)}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatDuration(duration)}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable hitSlop={10} style={styles.ctlSmall}>
            <Feather name="repeat" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable
            hitSlop={10}
            style={[styles.ctlSmall, !hasPrevious && { opacity: 0.35 }]}
            onPress={previous}
          >
            <Feather name="skip-back" size={28} color={colors.foreground} />
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={toggle}
            style={[styles.playBtn, { backgroundColor: colors.foreground }]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Feather name={isPlaying ? "pause" : "play"} size={32} color={colors.background} />
            )}
          </Pressable>
          <Pressable
            hitSlop={10}
            style={[styles.ctlSmall, !hasNext && { opacity: 0.35 }]}
            onPress={next}
          >
            <Feather name="skip-forward" size={28} color={colors.foreground} />
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
            <Feather name="heart" size={22} color={saved ? "#ff5252" : colors.foreground} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => setMenu(true)}
          style={[styles.downloadRow, { backgroundColor: colors.secondary }]}
        >
          <Feather name="download" size={18} color={colors.foreground} />
          <Text style={[styles.downloadText, { color: colors.foreground }]}>Download</Text>
        </Pressable>

        {/* YT Music style "Up next" list with previously-played history. */}
        {(upNext.length > 0 || history.length > 0) ? (
          <View style={styles.queueWrap}>
            <View style={styles.queueHeader}>
              <Text style={[styles.queueTitle, { color: colors.foreground }]}>Up next</Text>
              <Text style={[styles.queueSub, { color: colors.mutedForeground }]}>
                Autoplay is on
              </Text>
            </View>

            {upNext.map((track, i) => (
              <QueueRow
                key={`up-${track.videoId}-${i}`}
                item={track}
                colors={colors}
                onPress={() => playAt(queueIndex + 1 + i)}
              />
            ))}

            {history.length > 0 ? (
              <>
                <Text
                  style={[
                    styles.queueTitle,
                    { color: colors.foreground, marginTop: 22 },
                  ]}
                >
                  Recently played
                </Text>
                {[...history].reverse().slice(0, 8).map((track, i) => {
                  const realIdx = queueIndex - 1 - i;
                  return (
                    <QueueRow
                      key={`h-${track.videoId}-${i}`}
                      item={track}
                      colors={colors}
                      muted
                      onPress={() => playAt(realIdx)}
                    />
                  );
                })}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <VideoActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        videoId={current.videoId}
        title={current.title}
        artist={current.artist}
        thumbnail={current.thumbnail}
        duration={duration}
      />
    </View>
  );
}

function QueueRow({
  item,
  colors,
  onPress,
  muted,
}: {
  item: NowPlaying;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.queueRow}>
      <Image source={{ uri: item.thumbnail }} style={styles.queueThumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={[
            styles.queueRowTitle,
            { color: muted ? colors.mutedForeground : colors.foreground },
          ]}
        >
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.queueRowArtist, { color: colors.mutedForeground }]}>
          {item.artist}
        </Text>
      </View>
      <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 6,
  },
  iconBtn: { padding: 8 },
  headerLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginTop: 1,
  },
  artworkWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 22,
  },
  artwork: { width: "100%", aspectRatio: 1, borderRadius: 16 },
  metaBox: { paddingHorizontal: 32, paddingTop: 24, gap: 6 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  artist: { fontSize: 14, fontFamily: "Inter_500Medium" },
  progressBox: { paddingHorizontal: 32, paddingTop: 22 },
  progressBar: { paddingVertical: 8 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%" },
  timeRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  time: { fontSize: 12, fontFamily: "Inter_500Medium" },
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
  downloadRow: {
    marginHorizontal: 32,
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
  },
  downloadText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  queueWrap: {
    marginTop: 28,
    paddingHorizontal: 16,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  queueTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  queueSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  queueThumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: "#000" },
  queueRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  queueRowArtist: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
