/**
 * @file ui:progress-circle
 * @requires @seed-design/react@~1.0.0
 * @requires @seed-design/css@~1.0.0
 **/

import { ProgressCircle as SeedProgressCircle } from "@seed-design/react";
import * as React from "react";

export interface ProgressCircleProps extends SeedProgressCircle.RootProps {}

/**
 * @see https://seed-design.io/react/components/progress-circle
 */
export const ProgressCircle = React.forwardRef<SVGSVGElement, ProgressCircleProps>((props, ref) => {
  return (
    <SeedProgressCircle.Root ref={ref} {...props}>
      <SeedProgressCircle.Track />
      <SeedProgressCircle.Range />
    </SeedProgressCircle.Root>
  );
});

ProgressCircle.displayName = "ProgressCircle";

/**
 * This file is a snippet from SEED Design, helping you get started quickly with @seed-design/* packages.
 * You can extend this snippet however you want.
 */
