"use client";

import Link from "next/link";
import { ResultSection } from "@/ui/result-section";

/**
 * 백오피스 403 페이지.
 *
 * 관리자 권한이 없는 로그인 사용자가 /admin 영역에 접근하면
 * 게이트 레이아웃(src/app/admin/layout.tsx)이 이 페이지를 인라인으로 렌더한다.
 *
 * "use client" 인 이유: seed-design 컴포넌트(ResultSection)는 클라이언트 경계
 * 안에서만 써야 한다. 서버 컴포넌트가 seed를 직접 import하면 seed의 rolldown
 * 런타임이 등록한 __exportAll(client reference)가 페이지 데이터 수집 단계의 서버
 * 평가에서 호출되어 빌드가 깨진다(앱 전역 컨벤션: 홈→PlaylistView, auth/connect 등
 * 모두 seed는 "use client" 파일에서 사용).
 */
export default function AdminForbiddenPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        justifyContent: "center",
        backgroundColor: "var(--seed-color-bg-layer-default)",
      }}
    >
      <ResultSection
        title="관리자만 들어올 수 있어요"
        description={"이 페이지는 백오피스 관리자 전용이에요.\n권한이 필요하면 운영자에게 문의해 주세요."}
        primaryActionProps={{
          asChild: true,
          children: <Link href="/">홈으로 돌아가기</Link>,
        }}
      />
    </main>
  );
}
