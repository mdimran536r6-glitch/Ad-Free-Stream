import { Feather } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
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

import { VideoActionSheet } from "@/components/VideoActionSheet";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { extractVideoId, pipedSearch, type PipedSearchItem, type PipedStreamItem } from "@/lib/piped";

const MOODS = [
  { key: "Trending", q: "trending songs 2026" },
  { key: "Bangla", q: "bangla songs new" },
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

  const queries = useQueries({
    queries: [
      { queryKey: ["m-songs", mood.q], queryFn: () => pipedSearch(mood.q, "music_songs") },
      { queryKey: ["m-vids", mood.q], queryFn: () => pipedSearch(mood.q, "music_videos") },
      { queryKey: ["m-albums", mood.q], queryFn: () => pipedSearch(mood.q, "music_albums") },
      { queryKey: ["m-artists", mood.q], queryFn: () => pipedSearch(mood.q, "music_artists") },
      { queryKey: ["m-playlists", mood.q], queryFn: () => pipedSearch(mood.q, "music_playlists") },
    ],
  });

  const [songs, vids, albums, artists, playlists] = queries;

  const songItems = filterStreams(songs.data?.items);
  const videoItems = filterStreams(vids.data?.items);
  const albumItems = (albums.data?.items ?? []).filter((i) => i.type === "playlist") as Extract<
    PipedSearchItem,
    { type: "playlist" }
  >[];
  const artistItems = (artists.data?.items ?? []).filter((i) => i.type === "channel") as Extract<
    PipedSearchItem,
    { type: "channel" }
  >[];
  const playlistItems = (playlists.data?.items ?? []).filter((i) => i.type === "playlist") as Extract<
    PipedSearchItem,
    { type: "playlist" }
  >[];

  const isLoading = queries.every((q) => q.isLoading);

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={styles.header}>
        <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.brand, { color: colors.foreground }]}>Music</Text>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={10} onPress={() => router.push("/search")} style={styles.iconBtn}>
          <Feather name="search" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {MOODS.map((m) => {
            const active = mood.key === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMood(m)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.primary : colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {m.key}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {songItems.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick picks</Text>
                <View style={styles.quickGrid}>
                  {songItems.slice(0, 8).map((it) => (
                    <SongTile key={it.url} item={it} onPlay={play} />
                  ))}
                </View>
              </>
            ) : null}

            {videoItems.length > 0 ? (
              <>
                <RowHeader title="Music videos" colors={colors} />
                <FlatList
                  horizontal
                  data={videoItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
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
              </>
            ) : null}

            {albumItems.length > 0 ? (
              <>
                <RowHeader title="Albums & playlists" colors={colors} />
                <FlatList
                  horizontal
                  data={albumItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <View style={styles.albumCard}>
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.albumArtist, { color: colors.mutedForeground }]}>
                        {item.uploaderName ?? `${item.videos} songs`}
                      </Text>
                    </View>
                  )}
                />
              </>
            ) : null}

            {artistItems.length > 0 ? (
              <>
                <RowHeader title="Artists" colors={colors} />
                <FlatList
                  horizontal
                  data={artistItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        const cid = item.url.replace("/channel/", "");
                        router.push(`/channel/${cid}`);
                      }}
                      style={styles.artistCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.artistAvatar} contentFit="cover" />
                      <Text numberOfLines={1} style={[styles.albumTitle, { color: colors.foreground, textAlign: "center" }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {playlistItems.length > 0 ? (
              <>
                <RowHeader title="Recommended playlists" colors={colors} />
                <FlatList
                  horizontal
                  data={playlistItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <View style={styles.albumCard}>
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={[styles.albumTitle, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                    </View>
                  )}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SongTile({
  item,
  onPlay,
}: {
  item: PipedStreamItem;
  onPlay: (t: { videoId: string; title: string; artist: string; thumbnail: string }) => void;
}) {
  const colors = useColors();
  const [menu, setMenu] = useState(false);
  const id = extractVideoId(item.url);
  return (
    <>
      <Pressable
        onPress={() =>
          onPlay({ videoId: id, title: item.title, artist: item.uploaderName, thumbnail: item.thumbnail })
        }
        style={[styles.quickRow, { backgroundColor: colors.secondary }]}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.quickThumb} contentFit="cover" />
        <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text numberOfLines={1} style={[styles.quickTitle, { color: colors.foreground }]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={[styles.quickArtist, { color: colors.mutedForeground }]}>
            {item.uploaderName}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={() => setMenu(true)} style={{ paddingHorizontal: 10 }}>
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
      <VideoActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        videoId={id}
        title={item.title}
        artist={item.uploaderName}
        thumbnail={item.thumbnail}
        duration={item.duration}
        channelUrl={item.uploaderUrl}
      />
    </>
  );
}

function RowHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function filterStreams(items?: PipedSearchItem[]): PipedStreamItem[] {
  return ((items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[]);
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  brandDot: { width: 22, height: 22, borderRadius: 11 },
  brand: { fontSize: 20, fontFamily: "Inter_700Bold" },
  iconBtn: { padding: 6 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", paddingHorizontal: 14, marginTop: 18, marginBottom: 8 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, gap: 8 },
  quickRow: {
    width: "48%", flexDirection: "row", alignItems: "center", borderRadius: 10, overflow: "hidden", marginBottom: 8,
  },
  quickThumb: { width: 56, height: 56 },
  quickTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quickArtist: { fontSize: 11, fontFamily: "Inter_400Regular" },
  hList: { paddingHorizontal: 12, gap: 12 },
  albumCard: { width: 140, gap: 4, marginRight: 12 },
  albumArt: { width: 140, height: 140, borderRadius: 10, backgroundColor: "#000" },
  albumTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  albumArtist: { fontSize: 11, fontFamily: "Inter_400Regular" },
  artistCard: { width: 110, alignItems: "center", marginRight: 12, gap: 6 },
  artistAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#000" },
  center: { padding: 60, alignItems: "center" },
});
