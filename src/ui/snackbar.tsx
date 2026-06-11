/**
 * @file ui:snackbar
 * @requires @seed-design/react@~1.1.0
 * @requires @seed-design/css@~1.1.0
 **/

"use client";

import { Snackbar as SeedSnackbar } from "@seed-design/react";
import { forwardRef } from "react";
import type * as React from "react";

export { useSnackbarAdapter } from "@seed-design/react";

export interface SnackbarProps extends SeedSnackbar.RootProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const Snackbar = forwardRef<HTMLDivElement, SnackbarProps>(
  ({ message, actionLabel, onAction, ...props }, ref) => (
    <SeedSnackbar.Root ref={ref} {...props}>
      <SeedSnackbar.HiddenCloseButton aria-label="닫기" />
      <SeedSnackbar.Content>
        <SeedSnackbar.Message>{message}</SeedSnackbar.Message>
        {actionLabel && (
          <SeedSnackbar.ActionButton onClick={onAction}>{actionLabel}</SeedSnackbar.ActionButton>
        )}
      </SeedSnackbar.Content>
    </SeedSnackbar.Root>
  ),
);
Snackbar.displayName = "Snackbar";

export interface SnackbarProviderProps {
  children: React.ReactNode;
  pauseOnInteraction?: boolean;
}

export function SnackbarProvider({
  children,
  pauseOnInteraction = true,
}: SnackbarProviderProps) {
  return (
    <SeedSnackbar.RootProvider pauseOnInteraction={pauseOnInteraction}>
      {children}
      <SeedSnackbar.Region style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}>
        <SeedSnackbar.Renderer />
      </SeedSnackbar.Region>
    </SeedSnackbar.RootProvider>
  );
}
