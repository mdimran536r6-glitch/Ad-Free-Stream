import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Compact circular search button (YouTube-style top bar action).
 * No full-width pill — just an icon, so the top bar can fit logo + actions.
 */
export function SearchBar() {
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/search")}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name="search" size={22} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
