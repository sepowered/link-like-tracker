/**
 * @file ui:callout
 * @requires @seed-design/react@~1.1.0
 * @requires @seed-design/css@~1.1.0
 **/

import {
  CalloutRoot,
  CalloutContent,
  CalloutTitle,
  CalloutDescription,
  CalloutLink,
  PrefixIcon,
  type CalloutRootProps,
  type CalloutLinkProps,
} from "@seed-design/react";
import * as React from "react";

export interface CalloutProps
  extends Omit<CalloutRootProps, "children" | "title"> {
  title?: React.ReactNode;
  description: React.ReactNode;
  linkProps?: CalloutLinkProps;
  prefixIcon?: React.ReactNode;
}

/**
 * @see https://seed-design.io/react/components/callout
 */
export const Callout = React.forwardRef<
  React.ElementRef<typeof CalloutRoot>,
  CalloutProps
>(({ title, description, linkProps, prefixIcon, ...otherProps }, ref) => {
  return (
    <CalloutRoot ref={ref} {...otherProps}>
      {prefixIcon && <PrefixIcon svg={prefixIcon} />}
      <CalloutContent>
        {title && <CalloutTitle>{title}</CalloutTitle>}
        <CalloutDescription>{description}</CalloutDescription>
        {linkProps && <CalloutLink {...linkProps} />}
      </CalloutContent>
    </CalloutRoot>
  );
});
Callout.displayName = "Callout";

/**
 * This file is a snippet from SEED Design, helping you get started quickly with @seed-design/* packages.
 * You can extend this snippet however you want.
 */
