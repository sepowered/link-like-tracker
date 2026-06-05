/**
 * 요청 관리 타입.
 *
 * 지시어(`"use server"`/`"use client"`) 없는 순수 타입 모듈 — 서버 컴포넌트,
 * 서버 액션, 클라이언트 컴포넌트 어디서든 `import type`으로 가져올 수 있다.
 * (`requests-repo`는 `server-only`이므로 클라이언트에서 직접 import하면
 *  빌드 경계 위반이 나므로 여기로 분리한다.)
 */

export interface RequestRow {
  id: string;
  created_at: string;
  type: string;
  video_title: string | null;
  link: string | null;
  request_type: string | null;
  category: string | null;
  generation: string | null;
  description: string | null;
  status: string | null;
}
