import { createRecallClient } from "@recall/api-client";
import { API_BASE_URL } from "./config";
import { getStoredToken } from "./auth-storage";

// Singleton client. Reads the token fresh from SecureStore on every request
// so a sign-in / sign-out is picked up without re-instantiating.
export const api = createRecallClient({
  baseUrl: API_BASE_URL,
  getAuthToken: () => getStoredToken(),
});
