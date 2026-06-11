// 비로그인(localStorage) 유저용 Supabase 익명 세션.
//
// 새 시청 기록은 content.id 방식으로 Supabase에 저장하는 것이 목표지만,
// 익명 가입이 실패하면(네트워크, 프로젝트 설정에서 anonymous sign-in 꺼짐 등)
// 조용히 false를 돌려주고 기존 localStorage 경로가 그대로 동작한다(폴백).
//
// - 읽기 전용 preview(NEXT_PUBLIC_PROGRESS_READONLY)에서는 익명 가입 자체를 막는다
//   (preview가 프로덕션 Supabase와 같은 인스턴스를 쓰므로 auth.users 오염 방지).
// - NEXT_PUBLIC_ANON_SYNC=disabled 로 끌 수 있는 킬 스위치 제공.
// - 호출이 겹쳐도 가입은 한 번만(single-flight), 실패 시 60초 백오프.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isProgressWriteFrozen } from "./progress-write";

export function isAnonSyncEnabled(): boolean {
  if (isProgressWriteFrozen()) return false;
  return process.env.NEXT_PUBLIC_ANON_SYNC !== "disabled";
}

let inflight: Promise<boolean> | null = null;
let lastFailureAt = 0;
const RETRY_BACKOFF_MS = 60_000;

/**
 * 세션이 없으면 익명 세션을 만든다. 성공(기존 세션 포함) 시 true.
 * 실패해도 throw 하지 않는다 — 호출부는 localStorage 저장을 이미 마친 상태여야 한다.
 */
export async function ensureAnonymousSession(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (typeof window === "undefined" || !isAnonSyncEnabled()) return false;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
  } catch {
    return false;
  }

  if (Date.now() - lastFailureAt < RETRY_BACKOFF_MS) return false;

  if (!inflight) {
    inflight = supabase.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error || !data.session) {
          lastFailureAt = Date.now();
          console.warn("[progress] 익명 세션 생성 실패 — localStorage 저장만 사용:", error?.message);
          return false;
        }
        return true;
      })
      .catch((err) => {
        lastFailureAt = Date.now();
        console.warn("[progress] 익명 세션 생성 실패 — localStorage 저장만 사용:", err);
        return false;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
