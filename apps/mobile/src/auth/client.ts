import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import type { Database } from "@katipan/database/types";

const storage: SupportedStorage = {
  getItem: key => Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  setItem: (key, value) => Platform.OS === "web" ? (globalThis.localStorage?.setItem(key, value), undefined) : SecureStore.setItemAsync(key, value),
  removeItem: key => Platform.OS === "web" ? (globalThis.localStorage?.removeItem(key), undefined) : SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const hasSupabaseConfig = Boolean(url && key);
export const supabase = createClient<Database>(url || "https://placeholder.invalid", key || "missing-publishable-key", {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
