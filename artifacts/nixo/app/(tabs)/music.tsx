import { Feather } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

// YT-Music style fixed dark palette
const C = {
  bg: "#030303",
  surface: "rgba(255,255,255,0.04)",
  surfaceAlt: "rgba(255,255,255,0.07)",
  text: "#ffffff",
  subtext: "rgba(255,255,255,0.65)",
  accent: "#ff0844",
};

export default function MusicScreen() {
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
  const hero = songItems[0];

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + webTop }}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandCircle, { borderColor: C.accent }]}>
            <Feather name="play" size={9} color={C.accent} style={{ marginLeft: 1 }} />
          </View>
          <Text style={styles.brand}>Music</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={10} onPress={() => router.push("/search")} style={styles.iconBtn}>
          <Feather name="search" size={22} color="#fff" />
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
                  { backgroundColor: active ? "#fff" : "rgba(255,255,255,0.10)" },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#000" : "#fff" },
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
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <>
            {hero ? <Hero item={hero} onPlay={play} /> : null}

            {songItems.length > 0 ? (
              <>
                <SectionHeader title="Quick picks" />
                <View style={styles.quickGrid}>
                  {songItems.slice(0, 8).map((it) => (
                    <SongTile key={it.url} item={it} onPlay={play} />
                  ))}
                </View>
              </>
            ) : null}

            {albumItems.length > 0 ? (
              <>
                <SectionHeader title="Albums & playlists" />
                <FlatList
                  horizontal
                  data={albumItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        const pid = item.url.replace(/^\/playlist\?list=/, "").replace(/^\//, "");
                        router.push(`/playlist/${encodeURIComponent(pid)}`);
                      }}
                      style={styles.albumCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={styles.albumTitle}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.albumArtist}>
                        {item.uploaderName ?? `${item.videos} songs`}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {videoItems.length > 0 ? (
              <>
                <SectionHeader title="Music videos" />
                <FlatList
                  horizontal
                  data={videoItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => router.push(`/video/${extractVideoId(item.url)}`)}
                      style={styles.mvCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.mvArt} contentFit="cover" />
                      <Text numberOfLines={2} style={styles.albumTitle}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.albumArtist}>
                        {item.uploaderName}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {artistItems.length > 0 ? (
              <>
                <SectionHeader title="Artists" />
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
                      <Text numberOfLines={1} style={[styles.albumTitle, { textAlign: "center" }]}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.albumArtist, { textAlign: "center" }]}>
                        Artist
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            {playlistItems.length > 0 ? (
              <>
                <SectionHeader title="Recommended playlists" />
                <FlatList
                  horizontal
                  data={playlistItems.slice(0, 14)}
                  keyExtractor={(it) => it.url}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        const pid = item.url.replace(/^\/playlist\?list=/, "").replace(/^\//, "");
                        router.push(`/playlist/${encodeURIComponent(pid)}`);
                      }}
                      style={styles.albumCard}
                    >
                      <Image source={{ uri: item.thumbnail }} style={styles.albumArt} contentFit="cover" />
                      <Text numberOfLines={2} style={styles.albumTitle}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.albumArtist}>
                        {item.uploaderName ?? `${item.videos} songs`}
                      </Text>
                    </Pressable>
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

function Hero({
  item,
  onPlay,
}: {
  item: PipedStreamItem;
  onPlay: (t: { videoId: string; title: string; artist: string; thumbnail: string }) => void;
}) {
  const id = extractVideoId(item.url);
  return (
    <View style={styles.hero}>
      <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)", "rgba(3,3,3,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroBody}>
        <Image source={{ uri: item.thumbnail }} style={styles.heroArt} contentFit="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heroLabel}>Top pick for you</Text>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.heroArtist}>
            {item.uploaderName}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() =>
                onPlay({ videoId: id, title: item.title, artist: item.uploaderName, thumbnail: item.thumbnail })
              }
              style={styles.heroPlay}
            >
              <Feather name="play" size={14} color="#000" />
              <Text style={styles.heroPlayText}>Play</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  const [menu, setMenu] = useState(false);
  const id = extractVideoId(item.url);
  return (
    <>
      <Pressable
        onPress={() =>
          onPlay({ videoId: id, title: item.title, artist: item.uploaderName, thumbnail: item.thumbnail })
        }
        style={[styles.quickRow, { backgroundColor: C.surface }]}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.quickThumb} contentFit="cover" />
        <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text numberOfLines={1} style={styles.quickTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.quickArtist}>
            {item.uploaderName}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={() => setMenu(true)} style={{ paddingHorizontal: 10 }}>
          <Feather name="more-vertical" size={18} color={C.subtext} />
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

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function filterStreams(items?: PipedSearchItem[]): PipedStreamItem[] {
  return ((items ?? []).filter((i) => i.type === "stream") as PipedStreamItem[]);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  iconBtn: { padding: 6 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  hero: {
    margin: 14,
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 160,
    backgroundColor: "#1a1a1a",
  },
  heroBody: { flexDirection: "row", padding: 14, gap: 14 },
  heroArt: { width: 110, height: 110, borderRadius: 8, backgroundColor: "#000" },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  heroArtist: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  heroPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroPlayText: { color: "#000", fontSize: 13, fontFamily: "Inter_700Bold" },

  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 14,
    marginTop: 22,
    marginBottom: 10,
    color: "#fff",
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, gap: 8 },
  quickRow: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  quickThumb: { width: 56, height: 56 },
  quickTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  quickArtist: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.subtext },
  hList: { paddingHorizontal: 12, gap: 12 },
  albumCard: { width: 150, marginRight: 12 },
  albumArt: { width: 150, height: 150, borderRadius: 6, backgroundColor: "#000" },
  mvCard: { width: 220, marginRight: 12 },
  mvArt: { width: 220, height: 124, borderRadius: 6, backgroundColor: "#000" },
  albumTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8, color: "#fff" },
  albumArtist: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.subtext, marginTop: 2 },
  artistCard: { width: 120, alignItems: "center", marginRight: 12, gap: 6 },
  artistAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#000" },
  center: { padding: 60, alignItems: "center" },
});
