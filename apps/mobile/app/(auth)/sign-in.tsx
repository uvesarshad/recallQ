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
import { Redirect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  signInWithApple,
  useAppleSignInAvailability,
  useGoogleAuth,
} from "@/lib/oauth";

function getDefaultDeviceName(): string {
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return "Mobile";
}

export default function SignInScreen() {
  const router = useRouter();
  const { auth, signIn } = useAuth();
  const deviceName = getDefaultDeviceName();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"password" | "apple" | "google" | null>(null);

  const googleAuth = useGoogleAuth(deviceName);
  // Only available if Google web/iOS/Android client IDs are configured.
  const googleEnabled = Boolean(googleAuth.request);

  const appleEnabled = useAppleSignInAvailability();

  useEffect(() => {
    if (googleAuth.response?.type === "success") {
      void (async () => {
        try {
          const next = await googleAuth.exchange();
          if (next) {
            await signIn(next);
            router.replace("/(tabs)");
          }
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Google sign-in failed");
        } finally {
          setSubmitting(null);
        }
      })();
    } else if (googleAuth.response?.type === "error" || googleAuth.response?.type === "cancel") {
      setSubmitting(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleAuth.response]);

  if (auth) return <Redirect href="/(tabs)" />;

  async function handlePasswordSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting("password");
    try {
      const result = await api.auth.issueToken({
        email: email.trim(),
        password,
        device_name: deviceName,
      });
      await signIn({
        token: result.token,
        prefix: result.prefix,
        deviceName: result.device_name,
        email: email.trim(),
      });
      router.replace("/(tabs)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleApple() {
    setError(null);
    setSubmitting("apple");
    try {
      const next = await signInWithApple(deviceName);
      await signIn(next);
      router.replace("/(tabs)");
    } catch (caught) {
      // User cancelling the Apple sheet throws — silent.
      const message = caught instanceof Error ? caught.message : "Apple sign-in failed";
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting("google");
    try {
      await googleAuth.promptAsync();
      // Response handled by the useEffect above.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed");
      setSubmitting(null);
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
            Sign in with your RecallQ account. New here? Sign up at recallq.xyz and come back.
          </Text>

          {appleEnabled || googleEnabled ? (
            <View className="mt-6 gap-3">
              {appleEnabled ? (
                <Pressable
                  onPress={handleApple}
                  disabled={submitting !== null}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-black px-4 py-3.5 active:opacity-80 disabled:opacity-60"
                >
                  {submitting === "apple" ? <ActivityIndicator color="#fff" /> : null}
                  <Text className="text-base font-semibold text-white">
                    Continue with Apple
                  </Text>
                </Pressable>
              ) : null}
              {googleEnabled ? (
                <Pressable
                  onPress={handleGoogle}
                  disabled={submitting !== null}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 active:opacity-80 disabled:opacity-60"
                >
                  {submitting === "google" ? <ActivityIndicator color="#000" /> : null}
                  <Text className="text-base font-semibold text-black">
                    Continue with Google
                  </Text>
                </Pressable>
              ) : null}
              <View className="my-2 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-border" />
                <Text className="text-xs uppercase tracking-wider text-text-muted">Or</Text>
                <View className="h-px flex-1 bg-border" />
              </View>
            </View>
          ) : null}

          <View className="mt-2 gap-3">
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
            onPress={handlePasswordSubmit}
            disabled={submitting !== null}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 active:opacity-80 disabled:opacity-60"
          >
            {submitting === "password" ? <ActivityIndicator color="#fff" /> : null}
            <Text className="text-base font-semibold text-white">
              {submitting === "password" ? "Signing in…" : "Sign in with email"}
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
