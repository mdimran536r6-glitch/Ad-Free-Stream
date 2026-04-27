import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAudioModeAsync } from "expo-audio";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MiniPlayer } from "@/components/MiniPlayer";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { PlayerProvider } from "@/contexts/PlayerContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Routes that have their own bottom area / where the global MiniPlayer
// should NOT be rendered above content.
function shouldShowMiniPlayer(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/player")) return false;
  if (pathname.startsWith("/shorts")) return false;
  return true;
}

// Routes that mount their own bottom navigation bar (BottomNav or Tabs).
// On those, the MiniPlayer needs to sit ABOVE the bottom bar.
function hasBottomBar(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/player")) return false;
  if (pathname.startsWith("/shorts")) return false;
  if (pathname.startsWith("/search")) return false;
  return true;
}

function GlobalMiniPlayer() {
  const pathname = usePathname();
  if (!shouldShowMiniPlayer(pathname)) return null;
  const bottomOffset = hasBottomBar(pathname)
    ? Platform.OS === "ios"
      ? 78
      : 60
    : 0;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.miniWrap, { bottom: bottomOffset }]}
    >
      <MiniPlayer />
    </View>
  );
}

function RootLayoutNav() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="channel/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="playlist/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="shorts"
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="player"
          options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }}
        />
      </Stack>
      <GlobalMiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <LibraryProvider>
                <PlayerProvider>
                  <RootLayoutNav />
                </PlayerProvider>
              </LibraryProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
