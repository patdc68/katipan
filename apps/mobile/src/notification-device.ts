import type { Database } from "@katipan/database/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const INSTALLATION_ID_KEY = "katipan.notification.installation-id";

/** Call after sign-in on a native build, once the EAS project ID is configured. */
export async function registerNotificationDevice(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (!projectId) throw new Error("Expo project ID is required");
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in before registering a device");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "KATIPAN notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  let installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
  }
  const { data: existing, error: lookupError } = await client.from("notification_devices")
    .select("id").eq("user_id", user.id).eq("device_id", installationId).maybeSingle();
  if (lookupError) throw lookupError;
  const { error } = existing
    ? await client.from("notification_devices").update({
      expo_push_token: token,
      platform: Platform.OS,
      enabled: true,
      revoked_at: null,
    }).eq("id", existing.id)
    : await client.from("notification_devices").insert({
      user_id: user.id,
      device_id: installationId,
      expo_push_token: token,
      platform: Platform.OS,
      enabled: true,
    });
  if (error) throw error;
  return true;
}

/** Revoke this installation's destination before sign-out. */
export async function revokeNotificationDevice(client: SupabaseClient<Database>): Promise<void> {
  const installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (!installationId) return;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return;
  const { error } = await client.from("notification_devices")
    .update({ enabled: false, revoked_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("device_id", installationId);
  if (error) throw error;
}
