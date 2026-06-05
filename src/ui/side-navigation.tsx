/**
 * @file ui:side-navigation
 *
 * Composable SideNavigation built from seed-design primitives.
 * No hardcoded colors — all tokens from @seed-design/css.
 *
 * Anatomy:
 *   <SideNavRoot>
 *     <SideNavHeader />         — service name / logo area
 *     <SideNavContent>          — scrollable body
 *       <SideNavGroup>          — optional labeled group
 *         <SideNavItem />       — icon + label nav link
 *       </SideNavGroup>
 *     </SideNavContent>
 *     <SideNavFooter />         — auxiliary / external links
 *   </SideNavRoot>
 *
 * Responsive behaviour:
 *   lg (≥1024 px): sidebar always visible, expanded or collapsed.
 *   md (768–1023 px): sidebar auto-collapsed (icons only).
 *   sm (<768 px): hidden; open via <SideNavDrawerTrigger> → bottom-sheet drawer.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, ActionButton } from "@seed-design/react";
import { IconChevronLeftLine, IconChevronRightLine, IconXmarkLine } from "@karrotmarket/react-monochrome-icon";
import { BottomSheetRoot, BottomSheetTrigger, BottomSheetContent, BottomSheetBody } from "@/ui/bottom-sheet";

////////////////////////////////////////////////////////////////////////////////////
// Context

interface SideNavContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SideNavContext = React.createContext<SideNavContextValue | null>(null);

function useSideNav(): SideNavContextValue {
  const ctx = React.useContext(SideNavContext);
  if (!ctx) throw new Error("SideNav components must be used within <SideNavRoot>.");
  return ctx;
}

////////////////////////////////////////////////////////////////////////////////////
// Root

export interface SideNavRootProps {
  children: React.ReactNode;
  /** Initial collapsed state (desktop). Default false. */
  defaultCollapsed?: boolean;
}

export function SideNavRoot({ children, defaultCollapsed = false }: SideNavRootProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  // md breakpoint(768–1023px)에서 자동 접힘: CSS width 강제 대신 React state로 구동
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches);
    };
    // 초기값 적용
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <SideNavContext.Provider value={{ collapsed, setCollapsed }}>
      {/* Desktop sidebar */}
      <nav
        aria-label="관리자 내비게이션"
        data-collapsed={collapsed ? "" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          width: collapsed ? "60px" : "220px",
          minHeight: "100dvh",
          flexShrink: 0,
          backgroundColor: "var(--seed-color-bg-layer-default)",
          borderRight: "1px solid var(--seed-color-stroke-neutral-subtle)",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
        className="side-nav-desktop"
      >
        {children}
      </nav>
    </SideNavContext.Provider>
  );
}
SideNavRoot.displayName = "SideNavRoot";

////////////////////////////////////////////////////////////////////////////////////
// Collapse toggle

export function SideNavCollapseToggle() {
  const { collapsed, setCollapsed } = useSideNav();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: collapsed ? "center" : "flex-end",
        padding: "8px 8px 0",
      }}
    >
      <ActionButton
        variant="ghost"
        size="small"
        aria-label={collapsed ? "내비게이션 펼치기" : "내비게이션 접기"}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Icon
          svg={collapsed ? <IconChevronRightLine /> : <IconChevronLeftLine />}
          size="18px"
        />
      </ActionButton>
    </div>
  );
}
SideNavCollapseToggle.displayName = "SideNavCollapseToggle";

////////////////////////////////////////////////////////////////////////////////////
// Header

export interface SideNavHeaderProps {
  children: React.ReactNode;
}

export function SideNavHeader({ children }: SideNavHeaderProps) {
  const { collapsed } = useSideNav();
  return (
    <div
      style={{
        padding: collapsed ? "16px 0" : "20px 16px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
      }}
    >
      {!collapsed && children}
    </div>
  );
}
SideNavHeader.displayName = "SideNavHeader";

////////////////////////////////////////////////////////////////////////////////////
// Content (scrollable)

export interface SideNavContentProps {
  children: React.ReactNode;
}

export function SideNavContent({ children }: SideNavContentProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "8px 0",
      }}
    >
      {children}
    </div>
  );
}
SideNavContent.displayName = "SideNavContent";

////////////////////////////////////////////////////////////////////////////////////
// Group

export interface SideNavGroupProps {
  children: React.ReactNode;
  label?: string;
}

export function SideNavGroup({ children, label }: SideNavGroupProps) {
  const { collapsed } = useSideNav();
  return (
    <div role="group" aria-label={label} style={{ marginBottom: "4px" }}>
      {label && !collapsed && (
        <div
          style={{
            padding: "8px 16px 4px",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--seed-color-fg-neutral-subtle)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
SideNavGroup.displayName = "SideNavGroup";

////////////////////////////////////////////////////////////////////////////////////
// Item

export interface SideNavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Exact match for active detection. Default false (prefix match). */
  exact?: boolean;
}

export function SideNavItem({ href, label, icon, exact = false }: SideNavItemProps) {
  const { collapsed } = useSideNav();
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: collapsed ? "10px 0" : "10px 16px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "8px",
        margin: "1px 6px",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: isActive ? 600 : 400,
        color: isActive
          ? "var(--seed-color-fg-brand)"
          : "var(--seed-color-fg-neutral)",
        backgroundColor: isActive
          ? "var(--seed-color-bg-brand-weak)"
          : "transparent",
        transition: "background-color 0.1s ease, color 0.1s ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon svg={icon} size="20px" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
SideNavItem.displayName = "SideNavItem";

////////////////////////////////////////////////////////////////////////////////////
// Footer

export interface SideNavFooterProps {
  children: React.ReactNode;
}

export function SideNavFooter({ children }: SideNavFooterProps) {
  const { collapsed } = useSideNav();
  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid var(--seed-color-stroke-neutral-subtle)",
        padding: collapsed ? "8px 0" : "8px 6px",
      }}
    >
      {children}
    </div>
  );
}
SideNavFooter.displayName = "SideNavFooter";

////////////////////////////////////////////////////////////////////////////////////
// Mobile drawer trigger + drawer

export interface SideNavDrawerProps {
  children: React.ReactNode;
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
}

/**
 * Mobile-only drawer: wraps children in a BottomSheet.
 * Render at the top of the page layout (outside the desktop sidebar).
 */
export function SideNavDrawer({ children, triggerLabel = "메뉴", triggerIcon }: SideNavDrawerProps) {
  return (
    <BottomSheetRoot>
      <BottomSheetTrigger asChild>
        <ActionButton variant="ghost" size="medium" aria-label={triggerLabel}>
          {triggerIcon ? (
            <Icon svg={triggerIcon} size="22px" />
          ) : (
            <span style={{ fontSize: "14px" }}>{triggerLabel}</span>
          )}
        </ActionButton>
      </BottomSheetTrigger>
      <BottomSheetContent title={triggerLabel} showHandle>
        <BottomSheetBody>{children}</BottomSheetBody>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}
SideNavDrawer.displayName = "SideNavDrawer";

////////////////////////////////////////////////////////////////////////////////////
// Convenience flat-list nav item for use inside drawer (no collapsed state needed)

export interface SideNavDrawerItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  onNavigate?: () => void;
}

export function SideNavDrawerItem({ href, label, icon, exact = false }: SideNavDrawerItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        textDecoration: "none",
        fontSize: "16px",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "var(--seed-color-fg-brand)" : "var(--seed-color-fg-neutral)",
        backgroundColor: isActive ? "var(--seed-color-bg-brand-weak)" : "transparent",
        borderRadius: "8px",
      }}
    >
      <Icon svg={icon} size="22px" />
      <span>{label}</span>
    </Link>
  );
}
SideNavDrawerItem.displayName = "SideNavDrawerItem";
