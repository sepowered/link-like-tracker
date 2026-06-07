"use client";

/**
 * AdminShell — client component that renders the SideNavigation shell
 * around admin page content.
 *
 * Responsible for:
 * - Desktop sidebar (SideNavRoot) with collapse toggle
 * - Mobile top bar with drawer trigger
 * - Active-route highlighting via usePathname
 */

import * as React from "react";
import Link from "next/link";
import {
  IconDocumentLine,
  IconGridLine,
  IconHouseLine,
  IconHorizline3VerticalLine,
} from "@karrotmarket/react-monochrome-icon";
import {
  SideNavRoot,
  SideNavCollapseToggle,
  SideNavHeader,
  SideNavContent,
  SideNavGroup,
  SideNavItem,
  SideNavFooter,
  SideNavDrawer,
  SideNavDrawerItem,
} from "@/ui/side-navigation";

const NAV_ITEMS = [
  {
    href: "/admin/requests",
    label: "요청 관리",
    icon: <IconDocumentLine />,
  },
  {
    href: "/admin/catalog",
    label: "카탈로그",
    icon: <IconGridLine />,
  },
] as const;

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "var(--seed-color-bg-layer-default)",
      }}
    >
      {/* Desktop sidebar — hidden on small screens via CSS */}
      <div className="admin-sidebar">
        <SideNavRoot>
          <SideNavCollapseToggle />
          <SideNavHeader>
            <Link
              href="/admin"
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--seed-color-fg-neutral)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              백오피스
            </Link>
          </SideNavHeader>
          <SideNavContent>
            <SideNavGroup>
              {NAV_ITEMS.map((item) => (
                <SideNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </SideNavGroup>
          </SideNavContent>
          <SideNavFooter>
            <SideNavItem
              href="/"
              label="앱으로 돌아가기"
              icon={<IconHouseLine />}
              exact
            />
          </SideNavFooter>
        </SideNavRoot>
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflowX: "hidden",
        }}
      >
        {/* Mobile top bar — visible only on small screens via CSS */}
        <div
          className="admin-mobile-topbar"
          style={{
            display: "none",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
            backgroundColor: "var(--seed-color-bg-layer-default)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <SideNavDrawer triggerIcon={<IconHorizline3VerticalLine />} triggerLabel="메뉴">
            <div style={{ padding: "8px 0" }}>
              {NAV_ITEMS.map((item) => (
                <SideNavDrawerItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--seed-color-stroke-neutral-subtle)",
                  margin: "8px 16px",
                }}
              />
              <SideNavDrawerItem
                href="/"
                label="앱으로 돌아가기"
                icon={<IconHouseLine />}
                exact
              />
            </div>
          </SideNavDrawer>
          <span
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "var(--seed-color-fg-neutral)",
            }}
          >
            백오피스
          </span>
        </div>

        {/* Page content — data-tool: 페이지가 자체 패딩을 갖는 풀-블리드 영역.
            <main>은 바운디드 높이만 내려주고, 내부 테이블 뷰포트가 스크롤을 맡는다. */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            backgroundColor: "var(--seed-color-bg-layer-default)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
