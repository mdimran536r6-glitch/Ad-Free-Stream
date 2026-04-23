import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { extractVideoId, pipedSearch, type PipedStreamItem } from "@/lib/piped";
import { usePlayer } from "@/contexts/PlayerContext";

const MOODS = [
  { key: "Trending", q: "trending songs 2026" },
  { key: "Bangla", q: "bangla songs" },
  { key: "Hindi", q: "bollywood hits" },
  { key: "English", q: "top hits english" },
  { key: "Lo-fi", q: "lofi music" },
  { key: "Workout", q: "workout music" },
  { key: "Chill", q: "chill music" },
  { key: "Devotional", q: "devotional songs" },
];

export default function MusicScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { play } = usePlayer();
  const [mood, setMood] = useState(MOODS[0]);

  const songs = useQuery({
    queryKey: ["music", mood.key],
    queryFn: () => pipedSearch(mood.q, "music_songs"),
  });
  const videos = useQuery({
    queryKey: ["music-videos", mood.key],
    queryFn: () => pipedSearch(mood.q, "music_videos"),
  });
  const albums = useQuery({
    queryKey: ["music-albums", mood.key],
    queryFn: () => pipedSearch(mood.q, "music_albums"),
  });

  const songItems = (songs.data?.items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[];
  const videoItems = (videos.data?.items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[];

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={styles.header}>
        <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.brand, { color: colors.foreground }]}>Music</Text>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={10} onPress={() => router.push("/search?music=1")} style={styles.iconBtn}>
          <Feather name="search" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {MOODS.map((m) => {
            const active = mood.key === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMood(m)}
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.secondary }]}
              >
                <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                  {m.key}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {songs.isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick picks</Text>
            <View style={styles.quickGrid}>
              {songItems.slice(0, 6).map((it) => (
                <Pressable
                  key={it.url}
                  onPress={() => {
                    const id = extractVideoId(it.url);
                    play({ videoId: id, title: it.title, artist: it.uploaderName, thumbnail: it.thumbnail });
                  }}
                  style={[styles.quickRow, { backgroundColor: colors.secondary }]}
                >
                  <Image source={{ uri: it.thumbnail }} style={styles.quickThumb} contentFit="cover" />
                  <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text numberOfLines={1} style={[styles.quickTitle, { color: colors.foreground }]}>{it.title}</Text>
                    <Text numberOfLines={1} style={[styles.quickArtist, { color: colors.mutedForeground }]}>
                      {it.uploaderName}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Music videos</Text>
            <FlatList
              horizontal
              data={videoItems.slice(0, 12)}
              keyExtractor={(it) => it.url}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/video/${extractVideoId(item.url)}`)}
                  style={styles.albumCard}
                >
                  <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                  <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
                    {item.uploaderName}
                  </Text>
                </Pressable>
              )}
            />

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Albums</Text>
            <FlatList
              horizontal
              data={(albums.data?.items ?? []).slice(0, 12)}
              keyExtractor={(it) => it.url}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => {
                const t = item.type === "playlist" || item.type === "stream" ? item.thumbnail : "";
                const name = item.type === "playlist" ? item.name : item.type === "stream" ? item.title : "";
                return (
                  <View style={styles.albumCard}>
                    {t ? <Image source={{ uri: t }} style={styles.albumArt} contentFit="cover" /> : null}
                    <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>{name}</Text>
                  </View>
                );
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  brandDot: { width: 22, height: 22, borderRadius: 11 },
  brand: { fontSize: 20, fontFamily: "Inter_700Bold" },
  iconBtn: { padding: 6 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", paddingHorizontal: 14, marginTop: 16, marginBottom: 8 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, gap: 8 },
  quickRow: { width: "48%", flexDirection: "row", alignItems: "center", borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  quickThumb: { width: 56, height: 56 },
  quickTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quickArtist: { fontSize: 11, fontFamily: "Inter_400Regular" },
  albumCard: { width: 140, gap: 4 },
  albumArt: { width: 140, height: 140, borderRadius: 10, backgroundColor: "#000" },
  albumTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  albumArtist: { fontSize: 11, fontFamily: "Inter_400Regular" },
  center: { padding: 40, alignItems: "center" },
});
