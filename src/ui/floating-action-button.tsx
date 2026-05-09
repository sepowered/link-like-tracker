/**
 * @file ui:floating-action-button
 * @requires @seed-design/react@~1.0.0
 * @requires @seed-design/css@~1.0.0
 **/

import { FloatingActionButton as SeedFloatingActionButton } from "@seed-design/react";
import * as React from "react";

export interface FloatingActionButtonProps
  extends Omit<SeedFloatingActionButton.RootProps, "children"> {
  icon: React.ReactNode;

  label: React.ReactNode;
}

/**
 * @see https://seed-design.io/react/components/floating-action-button
 */
export const FloatingActionButton = React.forwardRef<
  React.ElementRef<typeof SeedFloatingActionButton.Root>,
  FloatingActionButtonProps
>(({ icon, label, ...otherProps }, ref) => {
  return (
    <SeedFloatingActionButton.Root ref={ref} {...otherProps}>
      <SeedFloatingActionButton.Icon svg={icon} />
      <SeedFloatingActionButton.Label>{label}</SeedFloatingActionButton.Label>
    </SeedFloatingActionButton.Root>
  );
});
FloatingActionButton.displayName = "FloatingActionButton";

/**
 * This file is a snippet from SEED Design, helping you get started quickly with @seed-design/* packages.
 * You can extend this snippet however you want.
 */
