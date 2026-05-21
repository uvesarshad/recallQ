import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ListItem } from "@recall/api-client";
import { api } from "@/lib/api";

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.items.get(id);
        setItem(result.item ?? null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (error || !item) {
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
