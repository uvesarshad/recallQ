-- Expo Push tokens registered by the mobile app. Each user can have several
-- (phone + tablet, work + personal device, etc.); we fan out to all active
-- tokens when a reminder fires.
--
-- `token` is the Expo Push token string (`ExponentPushToken[…]` or
-- `ExpoPushToken[…]`). It's a stable per-install identifier that Expo's
-- push service uses to route to APNs / FCM on our behalf.
--
-- Invalid-token cleanup: when the Expo push API returns
-- `DeviceNotRegistered` for a token, the reminder worker marks
-- `revoked_at = now()` so subsequent reminders skip it.

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
  ON device_push_tokens (user_id)
  WHERE revoked_at IS NULL;
