import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { useColors } from "@/hooks/useColors";
import { pipedTrending } from "@/lib/piped";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const trending = useQuery({
    queryKey: ["trending", "BD"],
    queryFn: () => pipedTrending("BD"),
  });
  const trendingUS = useQuery({
    queryKey: ["trending", "US"],
    queryFn: () => pipedTrending("US"),
  });

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTop }}>
      <SearchBar />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Quick picks" colors={colors}>
          {trending.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : trending.isError ? (
            <Text style={[styles.error, { color: colors.mutedForeground }]}>
              Couldn't load. Pull to refresh.
            </Text>
          ) : (
            (trending.data ?? []).slice(0, 6).map((item) => (
              <VideoCard key={item.url} item={item} />
            ))
          )}
        </Section>

        <Section title="Trending now" colors={colors}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(trendingUS.data ?? []).slice(0, 12).map((item) => (
              <VideoCard key={item.url} item={item} variant="grid" />
            ))}
          </ScrollView>
        </Section>

        <Section title="More for you" colors={colors}>
          {(trending.data ?? []).slice(6, 20).map((item) => (
            <VideoCard key={item.url} item={item} />
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  hScroll: { paddingHorizontal: 16, gap: 12 },
  loading: { padding: 40, alignItems: "center" },
  error: { padding: 16, fontFamily: "Inter_400Regular" },
});
