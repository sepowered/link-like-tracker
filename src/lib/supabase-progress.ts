import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressEntry, ProgressStatus } from "./progress-sync";
import type { CategoryOverrideValue } from "./storage";

export interface RemoteProgressRow {
  video_id: string;
  status: ProgressStatus;
  category_override: CategoryOverrideValue;
  updated_at: string;
}

export interface DeviceRow {
  device_id: string;
  device_name: string | null;
  last_seen_at: string;
  created_at: string;
}

export async function upsertDevice(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  deviceName?: string,
): Promise<void> {
  await supabase.from("user_devices").upsert(
    { user_id: userId, device_id: deviceId, device_name: deviceName ?? null, last_seen_at: new Date().toISOString() },
    { onConflict: "user_id,device_id" },
  );
}

export async function fetchDevices(
  supabase: SupabaseClient,
  userId: string,
): Promise<DeviceRow[]> {
  const { data } = await supabase
    .from("user_devices")
    .select("device_id, device_name, last_seen_at, created_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  return data ?? [];
}

export async function uploadProgress(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  entries: ProgressEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: userId,
    device_id: deviceId,
    video_id: e.videoId,
    status: e.status,
    category_override: e.categoryOverride ?? null,
    updated_at: e.updatedAt,
  }));
  const { error } = await supabase
    .from("user_progress")
    .upsert(rows, { onConflict: "user_id,device_id,video_id" });
  if (error) throw new Error(`uploadProgress: ${error.message}`);
}

export async function downloadProgress(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<RemoteProgressRow[]> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("video_id, status, category_override, updated_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  if (error) throw new Error(`downloadProgress: ${error.message}`);
  return data ?? [];
}

export async function deleteDeviceProgress(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<void> {
  await supabase.from("user_progress").delete().eq("user_id", userId).eq("device_id", deviceId);
  await supabase.from("user_devices").delete().eq("user_id", userId).eq("device_id", deviceId);
}

export async function deleteAllProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("user_progress").delete().eq("user_id", userId);
  if (error) throw new Error(`deleteAllProgress: ${error.message}`);
}

export async function fetchAllDevicesProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<RemoteProgressRow[]> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("video_id, status, category_override, updated_at")
    .eq("user_id", userId);
  if (error) throw new Error(`fetchAllDevicesProgress: ${error.message}`);
  // Last-write-wins across all devices
  const map = new Map<string, RemoteProgressRow>();
  for (const row of data ?? []) {
    const existing = map.get(row.video_id);
    if (!existing || row.updated_at > existing.updated_at) map.set(row.video_id, row);
  }
  return [...map.values()];
}
