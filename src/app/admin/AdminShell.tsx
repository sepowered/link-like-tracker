"use client";

/**
 * AdminShell v2 — 백오피스 셸 (좌측 내비 + 콘텐츠 영역).
 *
 * 데스크톱: 고정 사이드바. 모바일(≤860px): 상단 가로 스크롤 내비 바.
 * 활성 표시는 usePathname, 스타일은 admin.css(.adm-nav-*)가 담당한다.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowLeftLine,
  IconDocumentCheckmarkLine,
  IconGridLine,
  IconHouseLine,
} from "@karrotmarket/react-monochrome-icon";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드", icon: <IconHouseLine />, exact: true },
  { href: "/admin/requests", label: "요청", icon: <IconDocumentCheckmarkLine /> },
  { href: "/admin/catalog", label: "카탈로그", icon: <IconGridLine /> },
] as const;

function NavItem({
  href,
  label,
  icon,
  exact,
  count,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  count?: number;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className="adm-nav-item" data-active={active}>
      {icon}
      {label}
      {count !== undefined && count > 0 && <span className="adm-nav-count">{count}</span>}
    </Link>
  );
}

export default function AdminShell({
  pendingCount,
  children,
}: {
  /** 요청 내비 항목 옆에 표시할 대기 건수 (없으면 표시 안 함) */
  pendingCount?: number;
  children: React.ReactNode;
}) {
  const nav = NAV_ITEMS.map((item) => (
    <NavItem
      key={item.href}
      href={item.href}
      label={item.label}
      icon={item.icon}
      exact={"exact" in item ? item.exact : undefined}
      count={item.href === "/admin/requests" ? pendingCount : undefined}
    />
  ));

  return (
    <div className="adm-root adm-shell">
      <nav className="adm-nav" aria-label="백오피스 메뉴">
        <Link href="/admin" className="adm-nav-brand">
          <strong>백오피스</strong>
          <span>link-like</span>
        </Link>
        {nav}
        <div className="adm-nav-foot">
          <Link href="/" className="adm-nav-item">
            <IconArrowLeftLine />
            앱으로 돌아가기
          </Link>
        </div>
      </nav>

      <div className="adm-main">
        <div className="adm-mobile-bar" aria-label="백오피스 메뉴">
          {nav}
          <Link href="/" className="adm-nav-item">
            <IconArrowLeftLine />
            앱으로
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
