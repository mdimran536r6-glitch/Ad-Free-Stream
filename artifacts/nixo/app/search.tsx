import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNav } from "@/components/BottomNav";
import { VideoCard } from "@/components/VideoCard";
import { useColors } from "@/hooks/useColors";
import {
  extractChannelId,
  extractVideoId,
  pipedSearch,
  pipedSuggestions,
  type PipedSearchItem,
} from "@/lib/piped";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");
  const webTop = Platform.OS === "web" ? 67 : 0;

  const suggestions = useQuery({
    queryKey: ["suggest", text],
    queryFn: () => pipedSuggestions(text),
    enabled: text.length > 0 && submitted !== text,
    staleTime: 30_000,
  });

  const results = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => pipedSearch(submitted),
    enabled: submitted.length > 0,
  });

  useEffect(() => {
    // If user pasted a YouTube link, jump straight to video
    if (text.includes("youtu") && (text.includes("watch?v=") || text.includes("youtu.be/"))) {
      const id = extractVideoId(text);
      if (id && id.length === 11) {
        router.replace(`/video/${id}`);
      }
    }
  }, [text, router]);

  const submit = (q: string) => {
    setText(q);
    setSubmitted(q);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => submit(text)}
          placeholder="Search YouTube"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          style={[styles.input, { color: colors.foreground }]}
        />
        {text.length > 0 && (
          <Pressable hitSlop={10} onPress={() => setText("")} style={styles.iconBtn}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {submitted.length === 0 ? (
        <FlatList
          data={suggestions.data ?? []}
          keyExtractor={(s) => s}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => submit(item)} style={styles.suggestionRow}>
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <Text style={[styles.suggestionText, { color: colors.foreground }]}>{item}</Text>
            </Pressable>
          )}
        />
      ) : results.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : results.isError ? (
        <Text style={[styles.error, { color: colors.mutedForeground }]}>
          Search failed. Try again.
        </Text>
      ) : (
        <FlatList
          data={results.data?.items ?? []}
          keyExtractor={(it, idx) => `${it.url}-${idx}`}
          contentContainerStyle={{ paddingBottom: 140 }}
          renderItem={({ item }) => <ResultItem item={item} />}
        />
      )}
      <BottomNav />
    </View>
  );
}

function ResultItem({ item }: { item: PipedSearchItem }) {
  const colors = useColors();
  const router = useRouter();
  if (item.type === "stream") {
    return <VideoCard item={item} />;
  }
  if (item.type === "channel") {
    const id = extractChannelId(item.url);
    return (
      <Pressable
        onPress={() => router.push(`/channel/${id}`)}
        style={({ pressed }) => [styles.chRow, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View
          style={[styles.chAvatar, { backgroundColor: colors.muted, borderColor: colors.border }]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.chName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.chMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.subscribers >= 1000
              ? `${(item.subscribers / 1000).toFixed(0)}K subscribers`
              : `${item.subscribers} subscribers`}
            {" · "}
            {item.videos} videos
          </Text>
        </View>
      </Pressable>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 4,
  },
  iconBtn: { padding: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", paddingVertical: 8 },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  suggestionText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  center: { padding: 40, alignItems: "center" },
  error: { padding: 20, fontFamily: "Inter_400Regular" },
  chRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1 },
  chName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
