import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type StoredAuth,
} from "./auth-storage";
import { registerForPushNotifications } from "./push";

type AuthContextValue = {
  auth: StoredAuth | null;
  loading: boolean;
  signIn: (auth: StoredAuth) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredAuth();
      setAuth(stored);
      setLoading(false);
      // Already-signed-in users re-register their push token on every app
      // boot (it can rotate). Best-effort — failures are swallowed inside.
      if (stored) {
        void registerForPushNotifications(stored.deviceName);
      }
    })();
  }, []);

  const signIn = useCallback(async (next: StoredAuth) => {
    await setStoredAuth(next);
    setAuth(next);
    // Register push immediately after sign-in so the next reminder fires
    // to this device.
    void registerForPushNotifications(next.deviceName);
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredAuth();
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({ auth, loading, signIn, signOut }),
    [auth, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
