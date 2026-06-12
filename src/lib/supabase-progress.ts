import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressEntry, ProgressStatus } from "./progress-sync";
import type { CategoryOverrideValue } from "./storage";
import { isProgressWriteFrozen } from "./progress-write";

// Single chokepoint for the read-only guard. Returns true when the write must be
// suppressed (preview points at the production Supabase instance). Warns once so
// testers see why nothing persisted, without spamming the console.
let readonlyWarned = false;
function writeSuppressed(op: string): boolean {
  if (!isProgressWriteFrozen()) return false;
  if (!readonlyWarned && typeof console !== "undefined") {
    readonlyWarned = true;
    console.warn(
      `[progress] read-only mode active (NEXT_PUBLIC_PROGRESS_READONLY=enabled): ` +
        `database writes are suppressed. First blocked write: ${op}.`,
    );
  }
  return true;
}

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
  if (writeSuppressed("upsertDevice")) return;
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
  if (writeSuppressed("uploadProgress")) return;
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
  if (writeSuppressed("deleteDeviceProgress")) return;
  const { error: e1 } = await supabase.from("user_progress").delete().eq("user_id", userId).eq("device_id", deviceId);
  if (e1) throw new Error(`deleteDeviceProgress(progress): ${e1.message}`);
  const { error: e2 } = await supabase.from("user_devices").delete().eq("user_id", userId).eq("device_id", deviceId);
  if (e2) throw new Error(`deleteDeviceProgress(devices): ${e2.message}`);
}

// "이 기기 기록으로 맞추기"용: 현재 기기를 제외한 다른 기기들의 진행 행만 지운다.
// 호출부는 반드시 현재 기기 업로드가 '성공한 뒤'에 이 함수를 불러야 한다 —
// 업로드 실패 시 아무것도 지워지지 않아 원격 데이터가 보존된다(하드 제약).
export async function deleteOtherDevicesProgress(
  supabase: SupabaseClient,
  userId: string,
  keepDeviceId: string,
): Promise<void> {
  if (writeSuppressed("deleteOtherDevicesProgress")) return;
  const { error } = await supabase
    .from("user_progress")
    .delete()
    .eq("user_id", userId)
    .neq("device_id", keepDeviceId);
  if (error) throw new Error(`deleteOtherDevicesProgress: ${error.message}`);
}

export async function deleteAllProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (writeSuppressed("deleteAllProgress")) return;
  const { error } = await supabase.from("user_progress").delete().eq("user_id", userId);
  if (error) throw new Error(`deleteAllProgress: ${error.message}`);
}

export interface DeviceProgressStats {
  watchedCount: number;
  lastWatchedAt: string | null;
  lastWatchedVideoId: string | null;
}

export async function fetchDeviceProgressStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, DeviceProgressStats>> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("device_id, video_id, status, updated_at")
    .eq("user_id", userId);
  if (error) throw new Error(`fetchDeviceProgressStats: ${error.message}`);
  const map = new Map<string, DeviceProgressStats>();
  for (const row of data ?? []) {
    if (row.status !== "watched") continue;
    const existing = map.get(row.device_id) ?? { watchedCount: 0, lastWatchedAt: null, lastWatchedVideoId: null };
    existing.watchedCount++;
    if (!existing.lastWatchedAt || row.updated_at > existing.lastWatchedAt) {
      existing.lastWatchedAt = row.updated_at;
      existing.lastWatchedVideoId = row.video_id;
    }
    map.set(row.device_id, existing);
  }
  return map;
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
