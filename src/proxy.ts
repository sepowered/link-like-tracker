import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 세션 갱신 Proxy (Next 16: 구 middleware).
 *
 * @supabase/ssr 설계상 **필수**: 서버 컴포넌트/페이지는 쿠키를 쓸 수 없어
 * (getSupabaseServerClient의 setAll catch가 삼킴), 만료된 access token을 서버에서
 * 갱신하고 회전된 쿠키를 브라우저로 돌려주는 일은 반드시 proxy에서 해야 한다.
 * 이게 없으면 /admin 같은 서버측 인증 경로에서 토큰 만료 시 세션을 못 살려
 * requireAdmin/checkAdmin이 "Unauthorized"로 떨어지고 → /admin ↔ /auth/connect 루프.
 *
 * 범위는 /admin 으로만 한정한다(서버측 인증을 읽는 유일한 영역). 나머지 앱은
 * 전부 클라이언트 렌더라 createBrowserClient가 쿠키를 선제 갱신하므로 불필요.
 * 인가(admin 멤버십)는 여기서 하지 않고 layout/서버액션의 requireAdmin()에 둔다.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 회전된 쿠키를 request·response 양쪽에 심는다(정석 패턴).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 중요: createServerClient ~ getUser 사이에 다른 코드를 넣지 말 것.
  // getUser()가 만료 토큰을 감지하면 refresh를 수행하고 setAll로 쿠키를 회전한다.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
