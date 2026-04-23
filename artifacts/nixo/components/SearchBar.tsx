import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/useColors";

export function SearchBar() {
  const colors = useColors();
  const router = useRouter();
  return (
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  placeholder: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
