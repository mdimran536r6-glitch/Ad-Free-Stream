import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  onMenuPress?: () => void;
}

export function SearchBar({ onMenuPress }: Props) {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Text style={[styles.brand, { color: colors.primary }]}>Nixo</Text>
      <Pressable
        onPress={() => router.push("/search")}
        style={({ pressed }) => [
          styles.bar,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <Text style={[styles.placeholder, { color: colors.mutedForeground }]}>Search or paste link</Text>
      </Pressable>
      <Pressable hitSlop={10} onPress={onMenuPress} style={styles.menuBtn}>
        <Feather name="menu" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  brand: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  placeholder: { fontSize: 14, fontFamily: "Inter_400Regular" },
  menuBtn: { padding: 6 },
});
