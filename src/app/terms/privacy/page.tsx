import TermsPageHeader from "@/components/TermsPageHeader";

const SECTIONS = [
  {
    title: "1. 개인정보의 처리 목적",
    paragraphs: [
      "llt는 Google 계정 로그인 및 사용자 식별, 시청 기록 동기화, 기기별 기록 관리, 보기 설정 저장, 콘텐츠 요청 접수, 서비스 안정성 확인을 위해 개인정보를 처리합니다.",
    ],
  },
  {
    title: "2. 개인정보의 처리 및 보유 기간",
    paragraphs: [
      "계정 정보, 시청 기록, 동기화 설정은 사용자가 삭제를 요청할 때까지 보관합니다.",
      "콘텐츠 추가 및 수정 요청은 요청 처리 및 운영 기록 관리를 위해 최대 1년간 보관할 수 있습니다.",
      "브라우저 로컬 저장소에 저장된 정보는 사용자가 브라우저 저장소를 삭제하거나 앱에서 기록을 초기화할 때까지 기기에 남을 수 있습니다.",
    ],
  },
  {
    title: "3. 개인정보 처리 위탁 및 국외 처리",
    paragraphs: [
      "Supabase, Inc.는 인증, 데이터베이스 운영, 시청 기록 및 설정 동기화를 처리합니다. Supabase 프로젝트는 대한민국 서울 리전을 사용합니다.",
      "Vercel Inc.는 웹 호스팅, CDN, 접속 로그 처리, Web Analytics를 처리합니다. 처리 국가는 미국 및 Vercel 글로벌 인프라 위치 국가입니다.",
      "Google LLC 및 그 계열사는 Google OAuth 로그인 인증을 처리합니다. 처리 국가는 미국 등 Google 서비스 제공 국가입니다.",
      "Vercel Web Analytics는 기본적으로 쿠키를 사용하지 않고 집계된 방문 데이터를 제공합니다. 다만 웹사이트 접속과 분석 과정에서 IP 주소, 브라우저 정보, 기기 정보, 접속 URL, 접속 시각 등 요청 메타데이터가 처리될 수 있습니다.",
    ],
  },
  {
    title: "4. 정보주체의 권리와 행사 방법",
    paragraphs: [
      "사용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.",
      "요청은 hello@stile.im으로 보낼 수 있습니다.",
    ],
  },
  {
    title: "5. 처리하는 개인정보의 항목",
    paragraphs: [
      "Google 로그인 사용자의 이메일 주소, 이름, 프로필 이미지 URL, Google 계정 식별자, Supabase 사용자 ID, 기기 식별자, 시청 기록, 설정 정보, 접속 정보를 처리합니다.",
      "비로그인 사용자의 시청 기록, 필터 설정, 테마 설정은 브라우저 로컬 저장소에 저장됩니다. 콘텐츠 요청 시 사용자가 입력한 링크, 영상 제목, 분류, 기수, 요청 내용을 처리할 수 있습니다.",
      "Google 계정 비밀번호는 llt에 제공되지 않으며, llt는 Google 계정 비밀번호를 저장하지 않습니다.",
    ],
  },
  {
    title: "6. 개인정보의 파기",
    paragraphs: [
      "개인정보 처리 목적이 달성되거나 사용자가 삭제를 요청하면 지체 없이 개인정보를 파기합니다.",
      "데이터베이스 기록은 운영 데이터베이스에서 삭제하거나 익명 처리합니다. 로컬 저장소 데이터는 사용자가 브라우저 저장소 삭제 또는 앱 초기화를 통해 직접 삭제할 수 있습니다.",
    ],
  },
  {
    title: "7. 개인정보 자동 수집 장치",
    paragraphs: [
      "llt는 로그인 상태 유지, 시청 기록 저장, 테마 및 필터 설정 저장을 위해 브라우저 저장소(localStorage 등)를 사용합니다.",
      "사용자는 브라우저 설정에서 저장된 데이터를 삭제할 수 있습니다. 다만 저장된 데이터를 삭제하면 로그인 상태, 시청 기록, 보기 설정이 초기화될 수 있습니다.",
    ],
  },
  {
    title: "8. 개인정보 보호책임자",
    paragraphs: [
      "개인정보 보호책임자는 노권후입니다. 개인정보 관련 문의는 hello@stile.im으로 보낼 수 있습니다.",
    ],
  },
  {
    title: "9. 개인정보처리방침 변경",
    paragraphs: [
      "이 개인정보처리방침은 2026년 5월 9일부터 적용됩니다. 내용이 바뀌는 경우 서비스 화면 또는 문서로 안내합니다.",
    ],
  },
  {
    title: "10. 개인정보의 안전성 확보 조치",
    paragraphs: [
      "llt는 Supabase Row Level Security를 통한 사용자별 데이터 접근 제한, 인증된 사용자만 본인 데이터에 접근하도록 하는 권한 설정, HTTPS 전송, 필요한 개인정보만 수집하는 방식으로 개인정보를 보호합니다.",
    ],
  },
  {
    title: "11. 만 14세 미만 사용자의 이용",
    paragraphs: [
      "llt는 만 14세 이상 사용자만 Google 로그인과 시청 기록 동기화 기능을 사용할 수 있도록 동의를 받습니다.",
    ],
  },
];

export default function PrivacyTermsPage() {
  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title="개인정보 처리방침" />
        <article className="terms-page">
          <p>
            노권후는 link-like-tracker(이하 llt)를 제공함에 있어 개인정보 보호법 등
            관련 법령에 따라 사용자의 개인정보를 보호합니다.
          </p>

          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
