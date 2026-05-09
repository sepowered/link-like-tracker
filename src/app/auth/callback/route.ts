import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Google OAuth 콜백 Route Handler.
 *
 * iOS PWA에서 SVC(Safari View Controller)를 통해 Google 로그인 후,
 * Supabase가 ?code= 파라미터와 함께 이 엔드포인트로 리다이렉트한다.
 *
 * 서버에서 code를 세션으로 교환하고 쿠키를 심으므로,
 * SVC와 PWA의 localStorage가 격리되어 있어도 쿠키 기반으로 세션이 공유된다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    // code가 없으면 에러 페이지로
    return NextResponse.redirect(`${origin}/auth/ios-success?error=no_code`);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(`${origin}/auth/ios-success?error=exchange_failed`);
  }

  // 성공: SVC에서 창 닫기 안내 페이지로 이동
  // 쿠키는 이미 getSupabaseServerClient()의 setAll()을 통해 응답에 포함됨
  return NextResponse.redirect(`${origin}/auth/ios-success`);
}
