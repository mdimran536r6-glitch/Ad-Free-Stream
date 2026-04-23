import { Feather, FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { MiniPlayer } from "@/components/MiniPlayer";
import { useColors } from "@/hooks/useColors";

function YtHomeIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={{ width: 30, height: 22, backgroundColor: focused ? "#E53935" : color, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
      <FontAwesome name="play" size={9} color="#fff" />
    </View>
  );
}

function YtMusicIcon({ color, focused }: { color: string; focused: boolean }) {
  const c = focused ? "#E53935" : color;
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c, alignItems: "center", justifyContent: "center" }}>
      <FontAwesome name="play" size={8} color={c} style={{ marginLeft: 1 }} />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            ...(isWeb ? { height: 64 } : {}),
          },
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => <YtHomeIcon color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="music"
          options={{
            title: "Music",
            tabBarIcon: ({ color, focused }) => <YtMusicIcon color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="files"
          options={{
            title: "Downloads",
            tabBarIcon: ({ color }) => <Feather name="download" size={22} color={color} />,
          }}
        />
      </Tabs>
      <View style={styles.miniPlayerWrap} pointerEvents="box-none">
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  miniPlayerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "web" ? 64 : 60,
  },
});
