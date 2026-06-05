import Link from "next/link";

/**
 * 백오피스 랜딩 페이지 — /admin
 *
 * 관리자가 처음 진입했을 때 보이는 대시보드. 주요 섹션으로 바로가는 링크를 제공한다.
 */
export default function AdminPage() {
  return (
    <div style={{ maxWidth: "640px" }}>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--seed-color-fg-neutral)",
          marginBottom: "8px",
          letterSpacing: "-0.02em",
        }}
      >
        백오피스
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "var(--seed-color-fg-neutral-subtle)",
          marginBottom: "32px",
        }}
      >
        관리할 섹션을 선택해 주세요.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <AdminCard
          href="/admin/requests"
          title="요청 관리"
          description="추가·수정 요청을 검토하고 상태를 변경합니다."
        />
        <AdminCard
          href="/admin/catalog"
          title="카탈로그"
          description="콘텐츠 목록을 편집하고 순서를 조정합니다."
        />
      </div>
    </div>
  );
}

interface AdminCardProps {
  href: string;
  title: string;
  description: string;
}

function AdminCard({ href, title, description }: AdminCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid var(--seed-color-stroke-neutral-subtle)",
        backgroundColor: "var(--seed-color-bg-layer-default)",
        textDecoration: "none",
        transition: "background-color 0.1s ease",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--seed-color-fg-neutral)",
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--seed-color-fg-neutral-subtle)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </Link>
  );
}
