// Expo Push API client. Expo proxies push delivery to APNs (iOS) and FCM
// (Android) for free — no Apple / Google service-account configuration
// required on our side. The mobile app obtains its `ExpoPushToken[...]` via
// `Notifications.getExpoPushTokenAsync()` and posts it to
// `/api/v1/devices/push` for storage; this module is what
// `apps/web/workers/reminder-worker.ts` calls when fanning out a reminder.
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

import { logger } from "@/lib/logger";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo accepts up to 100 messages per request

export type ExpoPushMessage = {
  to: string;                       // ExpoPushToken[...]
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;               // Android notification channel
  priority?: "default" | "normal" | "high";
};

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: ExpoPushErrorCode | string };
    };

export type ExpoPushErrorCode =
  | "DeviceNotRegistered"
  | "InvalidCredentials"
  | "MessageTooBig"
  | "MessageRateExceeded"
  | "MismatchSenderId";

export type ExpoPushResult = {
  ticket: ExpoPushTicket;
  to: string;
};

// Sends messages in chunks of 100 (Expo's per-request cap). Returns tickets
// in the same order as inputs so the caller can correlate failures back to
// individual tokens.
export async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushResult[]> {
  if (messages.length === 0) return [];

  const results: ExpoPushResult[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn("expo-push", "Batch request failed", {
          status: response.status,
          body: text.slice(0, 500),
        });
        // Surface as per-token errors so the caller can decide to retry
        // individually; never throw out of here.
        for (const message of chunk) {
          results.push({
            to: message.to,
            ticket: { status: "error", message: `Expo Push HTTP ${response.status}` },
          });
        }
        continue;
      }

      const json = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = json.data ?? [];
      for (let j = 0; j < chunk.length; j++) {
        results.push({
          to: chunk[j].to,
          ticket: tickets[j] ?? { status: "error", message: "Missing ticket" },
        });
      }
    } catch (error) {
      logger.error("expo-push", "Batch request errored", {
        error: error instanceof Error ? error.message : String(error),
      });
      for (const message of chunk) {
        results.push({
          to: message.to,
          ticket: { status: "error", message: "Network error" },
        });
      }
    }
  }

  return results;
}

// Convenience: send a single message and return the ticket (or null if the
// network failed entirely).
export async function sendExpoPushMessage(message: ExpoPushMessage): Promise<ExpoPushTicket | null> {
  const [result] = await sendExpoPushBatch([message]);
  return result?.ticket ?? null;
}

export function isExpoPushToken(value: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(value) || /^ExpoPushToken\[[^\]]+\]$/.test(value);
}

// Returns true if Expo says the token is permanently dead so the caller
// should mark it revoked in our DB rather than retry.
export function isPermanentlyInvalid(ticket: ExpoPushTicket): boolean {
  if (ticket.status !== "error") return false;
  return ticket.details?.error === "DeviceNotRegistered";
}
