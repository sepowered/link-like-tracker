import TermsPageHeader from "@/components/TermsPageHeader";

const SECTIONS = [
  {
    title: "스토리를 파트 단위로 체크할 수 있어요",
    paragraphs: [
      "여러 파트가 한 영상으로 묶여 있던 스토리 23개를 파트별로 나눴어요. 이제 Part 단위로 시청 체크가 되고, 영상도 해당 파트가 시작하는 지점부터 바로 열려요.",
      "이미 남겨둔 시청 기록은 자동으로 파트별 기록으로 이어져요. 따로 할 일은 없어요.",
    ],
  },
  {
    title: "모든 스토리에서 자막 없는 영상을 볼 수 있어요",
    paragraphs: [
      "한국어 자막 영상만 있던 스토리 전체에 자막 없는 일본어 영상을 연결했어요. 콘텐츠를 눌러 '자막 없이 보기'를 선택하면 돼요.",
    ],
  },
  {
    title: "콘텐츠 언어 설정이 영상 선택까지 바꿔요",
    paragraphs: [
      "설정 > 언어의 콘텐츠 언어가 한국어면 자막 영상이, 日本語면 자막 없는 영상이 기본으로 열려요.",
      "선택한 언어의 영상이 아직 없는 콘텐츠에는 '자막 없음' 표시가 붙어요.",
    ],
  },
  {
    title: "빠져 있던 이야기들을 추가했어요",
    paragraphs: [
      "103기 막간 3편(하로메구 채널!, 즐거워 보이는데?, 하스노 대삼각☆)과 104기 막간 'Bloom the stars'를 추가했어요.",
      "105기 간주곡 Dream Interlude 두 장(Chapter.PERENNIAL, Chapter.BRIGHT SEEDS)도 목록에 들어왔어요.",
    ],
  },
  {
    title: "목록이 깔끔해졌어요",
    paragraphs: [
      "에피소드 목록이 기본으로 접혀 있고, 보고 있던 에피소드만 펼쳐져요. 검색하는 동안에는 모두 펼쳐져요.",
      "콘텐츠 메뉴를 열면 어느 기수 어느 장의 영상인지 함께 표시돼요. 공유할 때도 같은 정보가 담겨요.",
    ],
  },
  {
    title: "기기 목록을 자동으로 정리해요",
    paragraphs: [
      "오래 접속하지 않았고 기록이 모두 합쳐진 기기는 설정의 기기 목록에서 자동으로 정리돼요. 시청 기록은 사라지지 않아요.",
    ],
  },
  {
    title: "분류 수정 기능을 정리했어요",
    paragraphs: [
      "콘텐츠 분류를 직접 바꾸는 기능을 없앴어요. 잘못된 분류나 정보를 발견하면 콘텐츠 메뉴의 '정보 수정 요청'으로 알려주세요.",
    ],
  },
];

export const metadata = {
  title: "업데이트 안내 — link-like-tracker",
};

export default function UpdatesPage() {
  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title="2026년 6월 업데이트" />
        <article className="terms-page">
          <p>
            시청 기록을 더 정확하게 남기고 더 편하게 볼 수 있도록 다듬었어요.
            기존에 남긴 기록은 모두 그대로 유지돼요. (2026년 6월 12일)
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
