import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

/**
 * 서버 액션 전용 단순 클라이언트 (쿠키 없음).
 * Route Handler 이외의 서버 사이드 작업에 사용.
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

let browserClient: SupabaseClient | null = null;

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * @supabase/ssr의 createBrowserClient를 사용하므로,
 * 서버 Route Handler가 Set-Cookie로 심은 세션 쿠키를 자동으로 읽는다.
 * 덕분에 iOS PWA에서 SVC로 OAuth 후 쿠키 기반으로 세션이 복원된다.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
