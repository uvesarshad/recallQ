// Expo Push registration. Called from `AuthProvider.signIn` so freshly
// signed-in devices register their push token immediately; also called on
// app foreground in case the token rotated.
//
// The server stores tokens in `device_push_tokens` via
// POST /api/v1/devices/push and fans out reminders to them from the
// reminder worker (see apps/web/workers/reminder-worker.ts).

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { API_BASE_URL, IS_EXPO_GO } from "./config";
import { getStoredToken } from "./auth-storage";

let lastRegisteredToken: string | null = null;

function getExpoProjectId(): string | null {
  const explicit = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const configured =
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    Constants.easConfig?.projectId;
  return explicit ?? configured ?? null;
}

export async function registerForPushNotifications(deviceName: string): Promise<string | null> {
  // Expo Go is useful for most mobile development, but server-delivered
  // remote push should be validated in a dev build. Keep sign-in quiet by
  // skipping push registration in Expo Go.
  if (IS_EXPO_GO) {
    return null;
  }

  // Simulators cannot receive remote push, so avoid prompting there.
  if (!Device.isDevice) {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) return null;

  try {
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

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    if (!token) return null;

    // Avoid hammering the server with duplicate registrations within the
    // same session. The server upsert is idempotent, but no point.
    if (token === lastRegisteredToken) return token;

    const authToken = await getStoredToken();
    if (!authToken) return token;

    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    await fetch(`${API_BASE_URL}/devices/push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, platform, device_name: deviceName }),
    });
    lastRegisteredToken = token;
    return token;
  } catch {
    // Best-effort: if registration fails (Expo Go, offline, missing native
    // support, server down), retry on next sign-in / app foreground.
    return null;
  }
}

// Sets up the foreground notification handler. Without this, notifications
// sent while the app is open are silently dropped. Call once at app root.
export function configureNotificationHandling() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Notification support varies across Expo Go, simulator, and dev-build
    // environments. Foreground handling is best-effort.
  }
}

export function addNotificationResponseListener(
  listener: (itemId: string) => void,
): { remove: () => void } | null {
  try {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { itemId?: string };
      if (data?.itemId) listener(data.itemId);
    });
  } catch {
    return null;
  }
}
