import "../global.css";

import { useEffect, useRef } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import * as Notifications from "expo-notifications";
import { Stack, Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { configureNotificationHandling } from "@/lib/push";
import { syncPendingCaptures } from "@/lib/offline-queue";

configureNotificationHandling();

function RootStack() {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const lastAppState = useRef(AppState.currentState);

  // Drain the offline capture queue whenever the app comes back to the
  // foreground or the user signs in. Best-effort — failures keep the rows
  // in the queue with an error message visible on Capture.
  useEffect(() => {
    if (!auth) return;
    void syncPendingCaptures();
    const sub = AppState.addEventListener("change", (next) => {
      if (lastAppState.current.match(/inactive|background/) && next === "active") {
        void syncPendingCaptures();
      }
      lastAppState.current = next;
    });
    return () => sub.remove();
  }, [auth]);

  // Deep-link from a notification tap. The reminder worker sets
  // `data.itemId`; if present, jump straight to the item detail.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { itemId?: string };
      if (data?.itemId) {
        router.push(`/item/${data.itemId}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!auth) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0f0f11" },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)/sign-in" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
