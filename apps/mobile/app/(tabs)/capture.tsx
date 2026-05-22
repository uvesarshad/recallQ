import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import {
  countPendingCaptures,
  enqueueCapture,
  syncPendingCaptures,
} from "@/lib/offline-queue";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; queued?: boolean }
  | { kind: "error"; message: string };

const URL_PATTERN = /^https?:\/\/\S+$/i;

export default function CaptureScreen() {
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function refreshPendingCount() {
    setPendingCount(await countPendingCaptures());
  }

  useEffect(() => {
    void refreshPendingCount();
  }, []);

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setStatus({ kind: "saving" });

    const urlMatch = trimmed.match(URL_PATTERN);
    const payload = urlMatch
      ? {
          type: "url" as const,
          raw_url: urlMatch[0],
          raw_text: trimmed,
          capture_note: note.trim() || trimmed,
        }
      : {
          type: "text" as const,
          raw_url: null,
          raw_text: trimmed,
          capture_note: note.trim() || null,
        };

    try {
      if (payload.type === "url") {
        await api.ingest.url({
          url: payload.raw_url!,
          capture_note: payload.capture_note,
          source: "mobile",
        });
      } else {
        await api.ingest.text({
          text: payload.raw_text,
          capture_note: payload.capture_note,
          source: "mobile",
        });
      }
      setContent("");
      setNote("");
      setStatus({ kind: "success" });
    } catch (caught) {
      // Offline / server-down → queue locally and surface a friendly state.
      try {
        await enqueueCapture(payload);
        await refreshPendingCount();
        setContent("");
        setNote("");
        setStatus({ kind: "success", queued: true });
      } catch (queueErr) {
        setStatus({
          kind: "error",
          message:
            caught instanceof Error
              ? `${caught.message} (and failed to queue: ${queueErr instanceof Error ? queueErr.message : "unknown"})`
              : "Save failed",
        });
      }
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncPendingCaptures();
      await refreshPendingCount();
      if (result.synced > 0) {
        setStatus({ kind: "success" });
      } else if (result.failed > 0) {
        setStatus({ kind: "error", message: `Couldn't sync ${result.failed} item(s). Still offline?` });
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-5 pt-2">
          <Text className="text-2xl font-semibold text-text-primary">Capture</Text>
          <Text className="mt-1 text-xs text-text-muted">
            Paste a link or write a note. Add a folder name or `#tag` in the note field — the enrichment worker will pick it up.
          </Text>

          {pendingCount > 0 ? (
            <View className="mt-3 flex-row items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <Text className="flex-1 text-xs text-amber-300">
                {pendingCount} captured offline. Tap sync once you&apos;re back online.
              </Text>
              <Pressable
                onPress={handleSyncNow}
                disabled={syncing}
                className="ml-3 rounded-lg bg-amber-500/20 px-3 py-1.5 active:opacity-80 disabled:opacity-60"
              >
                <Text className="text-xs font-semibold text-amber-200">
                  {syncing ? "Syncing…" : "Sync now"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View className="mt-6 gap-3">
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Paste a URL or write a note…"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={6}
              accessibilityLabel="Content"
              className="min-h-[140px] rounded-xl border border-border bg-surface px-4 py-3 text-text-primary"
              textAlignVertical="top"
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note: remind me on 30 Jan · folder: work · #design"
              placeholderTextColor="#71717a"
              autoCorrect
              accessibilityLabel="Optional note"
              className="rounded-xl border border-border bg-surface px-4 py-3 text-text-primary"
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={status.kind === "saving" || !content.trim()}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 active:opacity-80 disabled:opacity-60"
          >
            {status.kind === "saving" ? <ActivityIndicator color="#fff" /> : null}
            <Text className="text-base font-semibold text-white">
              {status.kind === "saving" ? "Saving…" : "Save to RecallQ"}
            </Text>
          </Pressable>

          {status.kind === "success" ? (
            <View className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <Text className="text-sm text-emerald-300">
                {status.queued
                  ? "Saved locally. Will sync to your archive when you're back online."
                  : "Saved. Enrichment runs in the background."}
              </Text>
            </View>
          ) : null}
          {status.kind === "error" ? (
            <View className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <Text className="text-sm text-rose-300">{status.message}</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
