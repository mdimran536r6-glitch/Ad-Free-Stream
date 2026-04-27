import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNav } from "@/components/BottomNav";
import { VideoCard } from "@/components/VideoCard";
import { useColors } from "@/hooks/useColors";
import { pipedChannel } from "@/lib/piped";

type Tab = "videos" | "about";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("videos");
  const [subscribed, setSubscribed] = useState(false);

  const channel = useQuery({
    queryKey: ["channel", id],
    queryFn: () => pipedChannel(id!),
    enabled: !!id,
  });

  if (!id) return null;
  const data = channel.data;
  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  const formatSubs = (n?: number | null): string => {
    if (n == null || n < 0) return "";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B subscribers`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subscribers`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K subscribers`;
    if (n === 0) return "";
    return `${n} subscribers`;
  };

  const Header = (
    <View>
      {data?.bannerUrl ? (
        <Image source={{ uri: data.bannerUrl }} style={styles.banner} contentFit="cover" />
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.muted }]} />
      )}

      <View style={styles.profileRow}>
        <Image source={{ uri: data?.avatarUrl }} style={styles.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {data?.name}
            {data?.verified ? "  ✓" : ""}
          </Text>
          {formatSubs(data?.subscriberCount) ? (
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {formatSubs(data?.subscriberCount)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable
          onPress={() => setSubscribed((s) => !s)}
          style={[
            styles.subBtn,
            {
              backgroundColor: subscribed ? colors.secondary : colors.foreground,
            },
          ]}
        >
          <Text
            style={[
              styles.subBtnText,
              { color: subscribed ? colors.foreground : colors.background },
            ]}
          >
            {subscribed ? "SUBSCRIBED" : "SUBSCRIBE"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        {(["videos", "about"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t === "videos" ? "Videos" : "About"}
              </Text>
              {active ? <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      {tab === "about" && data?.description ? (
        <Text style={[styles.desc, { color: colors.foreground }]}>{data.description}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: topPad + 4,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {data?.name ?? ""}
        </Text>
      </View>

      {channel.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : channel.isError || !data ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Could not load channel
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            The artist or channel could not be reached. Please try again.
          </Text>
          <Pressable
            onPress={() => channel.refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.retryText, { color: colors.background }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tab === "videos" ? data.relatedStreams ?? [] : []}
          keyExtractor={(it, idx) => `${it.url}-${idx}`}
          renderItem={({ item }) => <VideoCard item={item} variant="feed" />}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            tab === "videos" ? (
              <View style={styles.empty}>
                <Feather name="video-off" size={22} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No videos available
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginLeft: 4 },
  iconBtn: { padding: 10 },
  center: { padding: 40, alignItems: "center", gap: 10 },
  empty: { padding: 30, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, marginTop: 6 },
  retryText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  banner: { width: "100%", aspectRatio: 16 / 5 },
  profileRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, gap: 14,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  btnRow: { paddingHorizontal: 16, paddingTop: 14 },
  subBtn: { paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  subBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingTop: 14, lineHeight: 20 },
  tabsRow: {
    flexDirection: "row", paddingHorizontal: 8, marginTop: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#33333322",
  },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabUnderline: { height: 2, marginTop: 6, borderRadius: 2 },
});
