import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Collection, ListItem } from "@recall/api-client";
import { api } from "@/lib/api";

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ListItem | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [reminderAt, setReminderAt] = useState("");

  useEffect(() => {
    if (!id) return;
    void loadItem(id);
  }, [id]);

  async function loadItem(itemId: string) {
    setLoading(true);
    setError(null);
    try {
      const [itemResult, collectionResult] = await Promise.all([
        api.items.get(itemId),
        api.collections.list(),
      ]);
      const nextItem = itemResult.item ?? null;
      setItem(nextItem);
      setCollections(collectionResult.collections);
      if (nextItem) {
        setTitle(nextItem.title ?? "");
        setNote(nextItem.capture_note ?? "");
        setTags((nextItem.tags ?? []).join(", "));
        setCollectionId(nextItem.collection_id);
        setReminderAt(toReminderInput(nextItem.reminder_at));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const dirty = useMemo(() => {
    if (!item) return false;
    return (
      title !== (item.title ?? "") ||
      note !== (item.capture_note ?? "") ||
      tags !== (item.tags ?? []).join(", ") ||
      collectionId !== item.collection_id ||
      reminderAt !== toReminderInput(item.reminder_at)
    );
  }, [collectionId, item, note, reminderAt, tags, title]);

  async function handleSave() {
    if (!item || !id || !dirty) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    const parsedReminder = parseReminderInput(reminderAt);
    if (reminderAt.trim() && !parsedReminder) {
      setSaving(false);
      setError("Use reminder format YYYY-MM-DD HH:mm, or leave it blank.");
      return;
    }
    try {
      await api.items.update(id, {
        title: title.trim() || "",
        capture_note: note.trim() || null,
        tags: parseTags(tags),
        collection_id: collectionId,
        reminder_at: parsedReminder,
      });
      const result = await api.items.get(id);
      const nextItem = result.item ?? item;
      setItem(nextItem);
      setTitle(nextItem.title ?? "");
      setNote(nextItem.capture_note ?? "");
      setTags((nextItem.tags ?? []).join(", "));
      setCollectionId(nextItem.collection_id);
      setReminderAt(toReminderInput(nextItem.reminder_at));
      setStatus("Saved. Newer edits from any device win by server sync time.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!item || !id || !item.raw_url) return;
    setArchiving(true);
    setStatus(null);
    setError(null);
    try {
      await api.items.archive(id);
      const result = await api.items.get(id);
      if (result.item) setItem(result.item);
      setStatus("Archive job queued.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to request archive");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
        <View className="px-5 pt-4">
          <Pressable onPress={() => router.back()}>
            <Text className="text-sm text-brand">← Back</Text>
          </Pressable>
          <Text className="mt-6 text-base font-semibold text-text-primary">
            {error ?? "Item not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-4">
          <Pressable onPress={() => router.back()}>
            <Text className="text-sm text-brand">← Back</Text>
          </Pressable>
        </View>

        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            className="mt-4 h-56 w-full"
            resizeMode="cover"
          />
        ) : null}

        <View className="px-5 pt-4">
          <Text className="text-xl font-semibold text-text-primary">
            {item.title || item.raw_url || "Untitled"}
          </Text>
          <Text className="mt-2 text-xs text-text-muted">
            Last updated {formatShortDate(item.updated_at)}
          </Text>
          {item.summary ? (
            <Text className="mt-3 text-sm leading-relaxed text-text-mid">
              {item.summary}
            </Text>
          ) : null}

          {item.tags && item.tags.length > 0 ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {item.tags.map((tag) => (
                <View
                  key={tag}
                  className="rounded-full bg-surface-2 px-3 py-1"
                >
                  <Text className="text-[11px] text-text-mid">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {item.raw_url ? (
            <Pressable
              onPress={() => void Linking.openURL(item.raw_url!)}
              className="mt-6 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-white">
                Open link
              </Text>
            </Pressable>
          ) : null}

          {item.raw_url ? (
            <View className="mt-3 rounded-xl border border-border bg-surface p-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-wider text-text-muted">
                    Archive
                  </Text>
                  <Text className="mt-1 text-sm text-text-primary">
                    {archiveStatusLabel(item.archive_status)}
                  </Text>
                  {item.archive_last_error ? (
                    <Text className="mt-1 text-xs text-rose-300">{item.archive_last_error}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleArchive}
                  disabled={archiving || item.archive_status === "pending" || item.archive_status === "processing"}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 active:opacity-80 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-text-primary">
                    {archiving ? "Queueing..." : item.archive_status === "available" ? "Refresh" : "Archive"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View className="mt-6 rounded-xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-text-primary">Edit item</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#71717a"
              className="mt-4 rounded-xl border border-border bg-bg px-4 py-3 text-text-primary"
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note"
              placeholderTextColor="#71717a"
              multiline
              textAlignVertical="top"
              className="mt-3 min-h-[88px] rounded-xl border border-border bg-bg px-4 py-3 text-text-primary"
            />
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="Tags: ai, reading"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              className="mt-3 rounded-xl border border-border bg-bg px-4 py-3 text-text-primary"
            />

            <Text className="mt-4 text-xs uppercase tracking-wider text-text-muted">Folder</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              <FolderChip
                label="No folder"
                selected={collectionId === null}
                onPress={() => setCollectionId(null)}
              />
              {collections.map((collection) => (
                <FolderChip
                  key={collection.id}
                  label={collection.name}
                  selected={collectionId === collection.id}
                  onPress={() => setCollectionId(collection.id)}
                />
              ))}
            </View>

            <TextInput
              value={reminderAt}
              onChangeText={setReminderAt}
              placeholder="Reminder: 2026-07-08 09:00"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              className="mt-4 rounded-xl border border-border bg-bg px-4 py-3 text-text-primary"
            />

            <Pressable
              onPress={handleSave}
              disabled={!dirty || saving}
              className="mt-4 flex-row items-center justify-center rounded-xl bg-brand px-4 py-3 active:opacity-80 disabled:opacity-50"
            >
              {saving ? <ActivityIndicator color="#fff" /> : null}
              <Text className="ml-2 text-sm font-semibold text-white">
                {saving ? "Saving..." : "Save changes"}
              </Text>
            </Pressable>
          </View>

          {status ? (
            <View className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <Text className="text-sm text-emerald-300">{status}</Text>
            </View>
          ) : null}
          {error ? (
            <View className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <Text className="text-sm text-rose-300">{error}</Text>
            </View>
          ) : null}

          {item.raw_text ? (
            <View className="mt-6 rounded-xl border border-border bg-surface p-4">
              <Text className="text-sm text-text-primary">{item.raw_text}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FolderChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        selected ? "border-brand bg-brand/20" : "border-border bg-surface-2"
      }`}
    >
      <Text className={`text-xs ${selected ? "text-brand" : "text-text-mid"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

function toReminderInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseReminderInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

function archiveStatusLabel(status: ListItem["archive_status"]): string {
  switch (status) {
    case "available":
      return "Saved snapshot available";
    case "pending":
      return "Queued";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return "Not archived";
  }
}
