import { Feather, FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Active = "home" | "music" | "files" | null;

interface Props {
  active?: Active;
}

export function BottomNav({ active = null }: Props) {
  const colors = useColors();
  const router = useRouter();
  const inactive = colors.mutedForeground;

  const go = (path: "/(tabs)" | "/(tabs)/music" | "/(tabs)/files") => {
    // navigate dedupes if the route is already on top of the stack
    router.navigate(path as never);
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Pressable style={styles.item} onPress={() => go("/(tabs)")} hitSlop={4}>
        <View
          style={[
            styles.homeIcon,
            { backgroundColor: active === "home" ? "#E53935" : inactive },
          ]}
        >
          <FontAwesome name="play" size={9} color="#fff" />
        </View>
        <Text
          style={[
            styles.label,
            { color: active === "home" ? colors.foreground : inactive },
          ]}
        >
          Home
        </Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => go("/(tabs)/music")} hitSlop={4}>
        <View
          style={[
            styles.musicIcon,
            {
              borderColor: active === "music" ? "#E53935" : inactive,
            },
          ]}
        >
          <FontAwesome
            name="play"
            size={8}
            color={active === "music" ? "#E53935" : inactive}
            style={{ marginLeft: 1 }}
          />
        </View>
        <Text
          style={[
            styles.label,
            { color: active === "music" ? colors.foreground : inactive },
          ]}
        >
          Music
        </Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => go("/(tabs)/files")} hitSlop={4}>
        <Feather
          name="download"
          size={22}
          color={active === "files" ? colors.foreground : inactive}
        />
        <Text
          style={[
            styles.label,
            { color: active === "files" ? colors.foreground : inactive },
          ]}
        >
          Downloads
        </Text>
      </Pressable>
    </View>
  );
}

export const BOTTOM_NAV_HEIGHT = Platform.OS === "ios" ? 78 : 60;

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    zIndex: 20,
  },
  item: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 4, gap: 3, minWidth: 64 },
  homeIcon: {
    width: 30,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  musicIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
