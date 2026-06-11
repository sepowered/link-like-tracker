import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * 백오피스 전용 service_role Supabase 클라이언트.
 *
 * service_role 키는 RLS를 우회하므로, 이 클라이언트는 절대 클라이언트 번들에
 * 포함되어선 안 된다. 파일 최상단의 `import "server-only";`가 클라이언트
 * 컴포넌트에서의 import를 빌드 단계에서 차단한다.
 *
 * 카탈로그/요청 관리의 유일한 쓰기 클라이언트다. 모든 호출부는 먼저
 * requireAdmin()(throwing variant)으로 관리자 권한을 확인한 뒤 사용해야 한다.
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // 서버 전용 클라이언트이므로 세션을 유지/갱신하지 않는다.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
