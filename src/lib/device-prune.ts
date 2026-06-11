import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressEntry } from "./progress-sync";
import {
  deleteDeviceProgress,
  downloadProgress,
  fetchDevices,
  type DeviceRow,
  type RemoteProgressRow,
} from "./supabase-progress";
import { isProgressWriteFrozen } from "./progress-write";

// 기기 식별자는 origin별 localStorage UUID라서 프리뷰 URL·포트·시크릿 창마다
// 새 "기기"가 생긴다. 여기서는 그렇게 쌓인 유령 기기를 동기화 시점에 정리한다.
// 삭제는 '지워도 잃는 데이터가 0임이 증명된 기기'로만 한정한다(하드 제약).

// 하루 이상 쓰인 일반 기기: 이 기간 미접속이어야 정리 후보.
export const DEVICE_STALE_DAYS = 30;
// 일회성 기기(등록된 날 이후 다시 안 옴): 대부분 프리뷰/시크릿 창 잔재라 더 일찍.
export const ONESHOT_STALE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function isOneShot(device: DeviceRow): boolean {
  return (
    new Date(device.last_seen_at).getTime() - new Date(device.created_at).getTime() < DAY_MS
  );
}

export function isStaleDevice(device: DeviceRow, now: number): boolean {
  const idleMs = now - new Date(device.last_seen_at).getTime();
  return idleMs > (isOneShot(device) ? ONESHOT_STALE_DAYS : DEVICE_STALE_DAYS) * DAY_MS;
}

// 후보 기기의 행 하나가 기준(남겨질 기기의 원격 기록)으로 완전히 대체되는지.
// remoteToEntries의 LWW 병합 의미론 기준으로, 이 행이 사라져도 미래의 어떤
// 병합 결과도 바뀌지 않을 때만 true. 조금이라도 애매하면 false(보존).
function isRowCovered(
  row: RemoteProgressRow,
  baseline: Map<string, ProgressEntry>,
  expandId: (id: string) => string[],
): boolean {
  const contentIds = expandId(row.video_id);
  const targets = contentIds.length > 0 ? contentIds : [row.video_id];
  return targets.every((id) => {
    const base = baseline.get(id);
    if (!base) return false;
    // 병합은 패자의 override로 빈자리를 채우므로(winner.override ?? loser.override),
    // 이 행만 갖고 있는 override는 기준에 override가 있어야 대체된다.
    if (row.category_override != null && base.categoryOverride === undefined) return false;
    if (base.updatedAt > row.updated_at) return true;
    if (base.updatedAt === row.updated_at) {
      // 동시각 tie는 watched 우선이므로, 기준이 watched거나 상태가 같으면 결과 동일.
      return base.status === row.status || base.status === "watched";
    }
    return false;
  });
}

/**
 * 오래 미접속이면서 기록이 keepDeviceId의 원격 기록으로 완전히 커버되는 기기를
 * 삭제한다. 커버되지 않는(고유 데이터가 있는) 기기는 절대 건드리지 않는다.
 * 반환값은 정리된 device_id 목록.
 */
export async function pruneRedundantDevices(
  supabase: SupabaseClient,
  userId: string,
  keepDeviceId: string,
  toEntries: (rows: RemoteProgressRow[]) => ProgressEntry[],
  expandId: (id: string) => string[],
): Promise<string[]> {
  if (isProgressWriteFrozen()) return [];

  const devices = await fetchDevices(supabase, userId);
  const now = Date.now();
  const candidates = devices.filter(
    (d) => d.device_id !== keepDeviceId && isStaleDevice(d, now),
  );
  if (candidates.length === 0) return [];

  const baselineRows = await downloadProgress(supabase, userId, keepDeviceId);
  const baseline = new Map(toEntries(baselineRows).map((e) => [e.videoId, e]));

  const pruned: string[] = [];
  for (const device of candidates) {
    const rows = await downloadProgress(supabase, userId, device.device_id);
    if (!rows.every((row) => isRowCovered(row, baseline, expandId))) continue;
    await deleteDeviceProgress(supabase, userId, device.device_id);
    pruned.push(device.device_id);
  }
  return pruned;
}
