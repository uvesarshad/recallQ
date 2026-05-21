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
import { Redirect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function getDefaultDeviceName(): string {
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return "Mobile";
}

export default function SignInScreen() {
  const router = useRouter();
  const { auth, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in — bounce to the feed.
  if (auth) return <Redirect href="/(tabs)" />;

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.auth.issueToken({
        email: email.trim(),
        password,
        device_name: getDefaultDeviceName(),
      });
      await signIn({
        token: result.token,
        prefix: result.prefix,
        deviceName: result.device_name,
        email: email.trim(),
      });
      router.replace("/(tabs)");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Sign-in failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <Text className="text-[10px] font-bold uppercase tracking-[3px] text-text-muted">
            RecallQ
          </Text>
          <Text className="mt-2 text-3xl font-semibold text-text-primary">
            Sign in
          </Text>
          <Text className="mt-2 text-sm text-text-mid">
            Use your RecallQ email and password. New here? Sign up at recallq.xyz and come back.
          </Text>

          <View className="mt-8 gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email"
              className="rounded-xl border border-border bg-surface px-4 py-3 text-text-primary"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#71717a"
              secureTextEntry
              textContentType="password"
              accessibilityLabel="Password"
              className="rounded-xl border border-border bg-surface px-4 py-3 text-text-primary"
            />
          </View>

          {error ? (
            <Text className="mt-3 text-sm text-rose-400">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 active:opacity-80 disabled:opacity-60"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : null}
            <Text className="text-base font-semibold text-white">
              {submitting ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>

          <Text className="mt-6 text-center text-xs text-text-muted">
            By signing in you authorize this device to capture and read items in your archive. Revoke any time from Settings → Connected devices on the web.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
