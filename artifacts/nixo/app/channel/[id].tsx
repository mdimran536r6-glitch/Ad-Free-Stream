import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoCard } from "@/components/VideoCard";
import { useColors } from "@/hooks/useColors";
import { pipedChannel } from "@/lib/piped";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const channel = useQuery({
    queryKey: ["channel", id],
    queryFn: () => pipedChannel(id!),
    enabled: !!id,
  });

  if (!id) return null;
  const data = channel.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {channel.isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
          {data.bannerUrl ? (
            <Image source={{ uri: data.bannerUrl }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, { backgroundColor: colors.muted }]} />
          )}

          <View style={styles.profileRow}>
            <Image source={{ uri: data.avatarUrl }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {data.name}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {data.subscriberCount >= 1000
                  ? `${(data.subscriberCount / 1000).toFixed(0)}K subscribers`
                  : `${data.subscriberCount} subscribers`}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <View style={[styles.subBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.subBtnText, { color: colors.primaryForeground }]}>SUBSCRIBE</Text>
            </View>
          </View>

          {data.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={3}>
              {data.description}
            </Text>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest videos</Text>
            {(data.relatedStreams ?? []).map((it) => (
              <VideoCard key={it.url} item={it} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 6 },
  iconBtn: { padding: 8 },
  center: { padding: 40, alignItems: "center" },
  banner: { width: "100%", aspectRatio: 16 / 5 },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  btnRow: { paddingHorizontal: 16, paddingTop: 14 },
  subBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  subBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingTop: 14, lineHeight: 18 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
