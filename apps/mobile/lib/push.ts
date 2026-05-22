// Expo Push registration. Called from `AuthProvider.signIn` so freshly
// signed-in devices register their push token immediately; also called on
// app foreground in case the token rotated.
//
// The server stores tokens in `device_push_tokens` via
// POST /api/v1/devices/push and fans out reminders to them from the
// reminder worker (see apps/web/workers/reminder-worker.ts).

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { API_BASE_URL } from "./config";
import { getStoredToken } from "./auth-storage";

let lastRegisteredToken: string | null = null;

export async function registerForPushNotifications(deviceName: string): Promise<string | null> {
  // Simulators can't receive push; bail without bothering the user with a
  // permission prompt.
  if (!Device.isDevice) {
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  // Android wants a channel for notifications to actually appear.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });
  const token = tokenResponse.data;
  if (!token) return null;

  // Avoid hammering the server with duplicate registrations within the
  // same session — the server upsert is idempotent, but no point.
  if (token === lastRegisteredToken) return token;

  const authToken = await getStoredToken();
  if (!authToken) return token;

  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  try {
    await fetch(`${API_BASE_URL}/devices/push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, platform, device_name: deviceName }),
    });
    lastRegisteredToken = token;
  } catch {
    // Best-effort: if the registration fails (offline, server down) we'll
    // retry on next sign-in / app-foreground.
  }

  return token;
}

// Sets up the foreground notification handler. Without this, notifications
// sent while the app is open are silently dropped. Call once at app root.
export function configureNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
