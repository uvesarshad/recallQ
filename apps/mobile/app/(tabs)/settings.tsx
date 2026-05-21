import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { auth, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert(
      "Sign out",
      "Sign out of this device? Your token will be revoked locally. You can also revoke it from the web at Settings → Connected devices.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/sign-in");
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
      <View className="px-5 pb-3 pt-2">
        <Text className="text-2xl font-semibold text-text-primary">Settings</Text>
      </View>

      <View className="mx-5 mt-2 rounded-2xl border border-border bg-surface">
        <Row label="Email" value={auth?.email ?? "—"} />
        <Separator />
        <Row label="Device" value={auth?.deviceName ?? "Mobile"} />
        <Separator />
        <Row
          label="Token"
          value={auth?.prefix ? `rq_${auth.prefix}…` : "—"}
          mono
        />
      </View>

      <View className="mx-5 mt-6">
        <Pressable
          onPress={handleSignOut}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 active:bg-rose-500/20"
        >
          <Text className="text-center text-sm font-semibold text-rose-300">
            Sign out of this device
          </Text>
        </Pressable>
      </View>

      <View className="mx-5 mt-8">
        <Text className="text-xs text-text-muted">
          To change your password, manage billing, or revoke other devices, sign in to recallq.xyz in your browser.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-sm text-text-mid">{label}</Text>
      <Text
        className={`text-sm text-text-primary ${mono ? "font-mono" : ""}`}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function Separator() {
  return <View className="h-px bg-border-soft" />;
}
