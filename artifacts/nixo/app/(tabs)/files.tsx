import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLibrary, type DownloadedItem, type SavedItem, type WatchHistoryItem } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { formatDuration } from "@/lib/piped";

type Tab = "downloads" | "saved" | "history";

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { downloads, items, history, removeDownload, remove, clearHistory } = useLibrary();
  const { play } = usePlayer();
  const [tab, setTab] = useState<Tab>("downloads");

  const webTop = Platform.OS === "web" ? 67 : 0;

  const renderDownload = ({ item }: { item: DownloadedItem }) => (
    <Pressable
      onPress={() => {
        play({ videoId: item.videoId, title: item.title, artist: item.artist, thumbnail: item.thumbnail, localUri: item.localUri });
      }}
      style={styles.row}
    >
      <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>
          {item.artist} · {item.format.toUpperCase()} · {(item.size / 1024 / 1024).toFixed(1)} MB
        </Text>
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => {
          Alert.alert("Delete download?", item.title, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => removeDownload(item.videoId, item.format) },
          ]);
        }}
        style={styles.iconBtn}
      >
        <Feather name="trash-2" size={18} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );

  const renderSaved = ({ item }: { item: SavedItem }) => (
    <Pressable
      onPress={() => router.push(`/video/${item.videoId}`)}
      style={styles.row}
    >
      <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>
          {item.artist} · {formatDuration(item.duration)}
        </Text>
      </View>
      <Pressable hitSlop={10} onPress={() => remove(item.videoId)} style={styles.iconBtn}>
        <Feather name="trash-2" size={18} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );

  const renderHistory = ({ item }: { item: WatchHistoryItem }) => (
    <Pressable onPress={() => router.push(`/video/${item.videoId}`)} style={styles.row}>
      <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>
          {item.channelName ?? "—"}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <Text style={[styles.brand, { color: colors.foreground }]}>Library</Text>

      <View style={styles.tabsRow}>
        {(["downloads", "saved", "history"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t === "downloads" ? "Downloads" : t === "saved" ? "Saved" : "History"}
              </Text>
              {active ? <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          );
        })}
        {tab === "history" && history.length > 0 ? (
          <Pressable
            onPress={() => {
              Alert.alert("Clear history?", undefined, [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => clearHistory() },
              ]);
            }}
            style={{ marginLeft: "auto", padding: 6 }}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {tab === "downloads" ? (
        <FlatList
          data={downloads}
          keyExtractor={(d) => `${d.videoId}-${d.format}`}
          renderItem={renderDownload}
          ListEmptyComponent={<Empty colors={colors} text="No downloads yet. Tap ⋮ on a video to download." />}
          contentContainerStyle={{ paddingBottom: 200 }}
        />
      ) : tab === "saved" ? (
        <FlatList
          data={items}
          keyExtractor={(i) => i.videoId}
          renderItem={renderSaved}
          ListEmptyComponent={<Empty colors={colors} text="Saved videos will appear here." />}
          contentContainerStyle={{ paddingBottom: 200 }}
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(h) => h.videoId}
          renderItem={renderHistory}
          ListEmptyComponent={<Empty colors={colors} text="Watch history will appear here." />}
          contentContainerStyle={{ paddingBottom: 200 }}
        />
      )}
    </View>
  );
}

function Empty({ colors, text }: { colors: ReturnType<typeof useColors>; text: string }) {
  return (
    <View style={styles.empty}>
      <Feather name="inbox" size={36} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 22, fontFamily: "Inter_700Bold", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  tabsRow: { flexDirection: "row", paddingHorizontal: 8, alignItems: "center" },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabUnderline: { height: 2, marginTop: 6, borderRadius: 2 },
  row: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 12, alignItems: "center" },
  thumb: { width: 96, height: 56, borderRadius: 8 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { padding: 6 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
});
