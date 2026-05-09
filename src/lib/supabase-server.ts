import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Route Handler / Server Component에서 사용하는 Supabase 클라이언트.
 * @supabase/ssr이 쿠키를 통해 세션을 읽고 쓰므로,
 * iOS PWA ↔ SVC 간 스토리지 격리 문제를 우회한다.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route Handler 외부(Server Component 렌더링 중)에서 호출될 경우 무시.
            // 미들웨어가 세션 갱신을 담당하므로 문제 없음.
          }
        },
      },
    },
  );
}
