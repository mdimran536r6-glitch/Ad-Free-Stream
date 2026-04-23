import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { MiniPlayer } from "@/components/MiniPlayer";
import { useColors } from "@/hooks/useColors";

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
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="files"
          options={{
            title: "My Files",
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
    bottom: Platform.OS === "web" ? 84 : 60,
  },
});
