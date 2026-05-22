import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import type { ListItem } from "@recall/api-client";
import { api } from "@/lib/api";
import { listPendingCaptures, type PendingCapture } from "@/lib/offline-queue";

// Adapter so pending offline captures can render in the same FlatList row
// component as server-side items, marked with a `pending: true` flag.
type FeedRow = (ListItem & { pending?: false }) | (LocalPendingRow & { pending: true });

type LocalPendingRow = {
  id: string;
  type: "url" | "text";
  title: null;
  summary: null;
  tags: null;
  source: "mobile";
  created_at: string;
  raw_url: string | null;
  raw_text: string | null;
  collection_id: null;
  collection_name: null;
  enriched: false;
  reminder_at: null;
  reminder_sent: false;
  image_url: null;
  blur_data_url: null;
  file_name: null;
  file_mime_type: null;
};

function fromPending(row: PendingCapture): FeedRow {
  return {
    pending: true,
    id: `pending-${row.id}`,
    type: row.type,
    title: null,
    summary: null,
    tags: null,
    source: "mobile",
    created_at: row.created_at,
    raw_url: row.raw_url,
    raw_text: row.raw_text,
    collection_id: null,
    collection_name: null,
    enriched: false,
    reminder_at: null,
    reminder_sent: false,
    image_url: null,
    blur_data_url: null,
    file_name: null,
    file_mime_type: null,
  };
}

export default function FeedScreen() {
  const [items, setItems] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    // Local pending captures always render — even if the server fetch
    // fails, the user sees what they captured offline.
    const pending = await listPendingCaptures().then((rows) => rows.map(fromPending));
    try {
      const data = await api.items.list({ limit: 50 });
      const server: FeedRow[] = (data.items ?? []).map((item) => ({ ...item, pending: false }));
      setItems([...pending, ...server]);
    } catch (caught) {
      setItems(pending);
      setError(caught instanceof Error ? caught.message : "Failed to load server items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
      <View className="px-5 pb-3 pt-2">
        <Text className="text-2xl font-semibold text-text-primary">Your archive</Text>
        <Text className="mt-1 text-xs text-text-muted">
          {items.length === 0 && !loading ? "Capture something below to get started." : `${items.length} item${items.length === 1 ? "" : "s"}`}
        </Text>
      </View>

      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            error ? (
              <View className="mt-12 rounded-2xl border border-border bg-surface p-6">
                <Text className="text-sm text-rose-400">{error}</Text>
              </View>
            ) : (
              <EmptyState />
            )
          }
          renderItem={({ item }) => <ItemRow item={item} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
        />
      )}
    </SafeAreaView>
  );
}

function ItemRow({ item }: { item: FeedRow }) {
  const title = item.title || item.raw_url || item.file_name || item.raw_text?.slice(0, 80) || "Untitled";
  const host = (() => {
    if (!item.raw_url) return null;
    try {
      return new URL(item.raw_url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  // Offline-only rows: render the same card but unlinked (no server id yet)
  // and badged "Pending sync". Once the queue drains, the row is replaced
  // with the real server item.
  if (item.pending) {
    return (
      <View className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <View className="p-4">
          <Text className="text-sm font-medium text-text-primary" numberOfLines={2}>
            {title}
          </Text>
          <View className="mt-3 flex-row items-center gap-2">
            <Text className="text-[11px] uppercase tracking-wider text-amber-300">
              Pending sync
            </Text>
            {host ? <Text className="text-[11px] text-text-muted">· {host}</Text> : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <Link href={`/item/${item.id}`} asChild>
      <Pressable className="overflow-hidden rounded-2xl border border-border bg-surface active:bg-surface-2">
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            className="h-40 w-full"
            resizeMode="cover"
          />
        ) : null}
        <View className="p-4">
          <Text className="text-sm font-medium text-text-primary" numberOfLines={2}>
            {title}
          </Text>
          {item.summary ? (
            <Text className="mt-1 text-xs text-text-mid" numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View className="mt-3 flex-row items-center gap-2">
            <Text className="text-[11px] uppercase tracking-wider text-text-muted">
              {item.type}
            </Text>
            {host ? <Text className="text-[11px] text-text-muted">· {host}</Text> : null}
            {!item.enriched ? (
              <Text className="text-[11px] text-brand">· enriching…</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <View className="mt-16 items-center px-8">
      <Text className="text-base font-semibold text-text-primary">No items yet</Text>
      <Text className="mt-2 text-center text-sm text-text-mid">
        Tap the Capture tab to save a link or note. New items from the web app or extension also land here automatically.
      </Text>
    </View>
  );
}
