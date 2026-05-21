import { createRecallClient } from "@recall/api-client";
import { API_BASE_URL } from "./config";
import { getStoredToken } from "./auth-storage";

// Singleton API client. Each call reads the latest token from storage so a
// fresh sign-in is picked up without re-creating the client.
export const apiClient = createRecallClient({
  baseUrl: API_BASE_URL,
  getAuthToken: () => getStoredToken(),
});
