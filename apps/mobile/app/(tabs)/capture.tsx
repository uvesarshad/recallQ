import { useState } from "react";
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

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const URL_PATTERN = /^https?:\/\/\S+$/i;

export default function CaptureScreen() {
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setStatus({ kind: "saving" });
    try {
      const urlMatch = trimmed.match(URL_PATTERN);
      if (urlMatch) {
        await api.ingest.url({
          url: urlMatch[0],
          capture_note: note.trim() || trimmed,
          source: "mobile",
        });
      } else {
        await api.ingest.text({
          text: trimmed,
          capture_note: note.trim() || null,
          source: "mobile",
        });
      }
      setContent("");
      setNote("");
      setStatus({ kind: "success" });
    } catch (caught) {
      setStatus({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Save failed",
      });
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
              <Text className="text-sm text-emerald-300">Saved. Enrichment runs in the background.</Text>
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
