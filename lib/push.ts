import webpush from "web-push";
import { env } from "@/lib/env";

let configured = false;

function configure() {
  if (configured) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

export function isPushEnabled() {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  payload: { title: string; body: string; url?: string }
) {
  configure();
  if (!isPushEnabled()) return;
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
