/**
 * @file ui:switch
 * @requires @seed-design/react@~1.2.0
 * @requires @seed-design/css@~1.2.0
 **/

import * as React from "react";
import { Switch as SeedSwitch } from "@seed-design/react";

export interface SwitchProps extends SeedSwitch.RootProps {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;

  rootRef?: React.Ref<HTMLLabelElement>;

  label?: React.ReactNode;
}

/**
 * @see https://seed-design.io/react/components/switch
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ inputProps, rootRef, label, ...otherProps }, ref) => {
    return (
      <SeedSwitch.Root ref={rootRef} {...otherProps}>
        <SeedSwitch.Control>
          <SeedSwitch.Thumb />
        </SeedSwitch.Control>
        {label && <SeedSwitch.Label>{label}</SeedSwitch.Label>}
        <SeedSwitch.HiddenInput ref={ref} {...inputProps} />
      </SeedSwitch.Root>
    );
  },
);
Switch.displayName = "Switch";

export type SwitchmarkProps = SeedSwitch.ControlProps;

/**
 * @see https://seed-design.io/react/components/switch
 */
export const Switchmark = React.forwardRef<HTMLDivElement, SwitchmarkProps>((props, ref) => {
  return (
    <SeedSwitch.Control ref={ref} {...props}>
      <SeedSwitch.Thumb />
    </SeedSwitch.Control>
  );
});
Switchmark.displayName = "Switchmark";

/**
 * @deprecated Use `Switchmark` instead. Will be removed in @seed-design/react@1.3.0.
 */
export const SwitchMark = Switchmark;

/**
 * @deprecated Use `SwitchmarkProps` instead. Will be removed in @seed-design/react@1.3.0.
 */
export type SwitchMarkProps = SwitchmarkProps;

/**
 * This file is a snippet from SEED Design, helping you get started quickly with @seed-design/* packages.
 * You can extend this snippet however you want.
 */
