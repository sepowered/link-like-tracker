// 레거시 localStorage 원본의 일회성 불변 백업.
//
// 하드 제약: 기존 유저의 시청 데이터(llt-watched / llt-overrides)는 어떤 경우에도
// 잃어버리면 안 된다. 새 저장 방식(v2 store / content.id / Supabase)이 레거시 키를
// 변형(미러 재작성)하기 전에, 원본을 그대로 별도 키에 한 번 떠 둔다.
//
// - 원시 문자열을 그대로 보관한다(파싱 실패/손상 데이터도 원형 보존).
// - 백업 키가 이미 있으면 절대 다시 쓰지 않는다(불변).
// - 실패해도 앱 동작을 막지 않는다(보험 장치일 뿐).

const BACKUP_KEY = "llt-legacy-backup-v1";
const LEGACY_KEY_WATCHED = "llt-watched";
const LEGACY_KEY_OVERRIDES = "llt-overrides";

export interface LegacyBackup {
  backedUpAt: string;
  /** localStorage 원시 문자열 그대로 (없었으면 null) */
  watchedRaw: string | null;
  overridesRaw: string | null;
}

export function ensureLegacyBackup(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(BACKUP_KEY) !== null) return; // 불변 — 재기록 금지

    const watchedRaw = localStorage.getItem(LEGACY_KEY_WATCHED);
    const overridesRaw = localStorage.getItem(LEGACY_KEY_OVERRIDES);
    if (watchedRaw === null && overridesRaw === null) return; // 백업할 레거시 없음

    const backup: LegacyBackup = {
      backedUpAt: new Date().toISOString(),
      watchedRaw,
      overridesRaw,
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // 백업 실패가 본 기능을 막아서는 안 된다 (예: 저장공간 초과)
  }
}

export function loadLegacyBackup(): LegacyBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as LegacyBackup) : null;
  } catch {
    return null;
  }
}
