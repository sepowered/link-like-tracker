/**
 * @file ui:accordion
 * @requires @seed-design/react@~0.0.0-alpha
 * @requires @seed-design/css@~0.0.0-alpha
 **/

import {
  AccordionRoot,
  AccordionItem as AccordionItemPrimitive,
  AccordionHeader,
  AccordionTrigger as AccordionTriggerPrimitive,
  AccordionContent as AccordionContentPrimitive,
  AccordionBody,
  AccordionTitle,
  AccordionDescription,
  AccordionPrefix,
  AccordionSuffixIcon,
  Icon,
  type AccordionRootProps,
  type AccordionItemProps,
  type AccordionContentProps,
} from "@seed-design/react";
import { IconChevronDownLine } from "@karrotmarket/react-monochrome-icon";
import * as React from "react";

export type { AccordionRootProps as AccordionProps, AccordionItemProps, AccordionContentProps };

/**
 * @see https://alpha.seed-design.pages.dev/react/components/accordion
 */
export const Accordion = AccordionRoot;

export const AccordionItem = AccordionItemPrimitive;

export const AccordionContent = AccordionContentPrimitive;

export interface AccordionTriggerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  prefix?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  (
    { title, description, prefix, suffixIcon = <Icon svg={<IconChevronDownLine />} />, headingLevel },
    ref,
  ) => (
    <AccordionHeader headingLevel={headingLevel}>
      <AccordionTriggerPrimitive ref={ref}>
        {prefix && <AccordionPrefix>{prefix}</AccordionPrefix>}
        <AccordionBody>
          <AccordionTitle>{title}</AccordionTitle>
          {description && <AccordionDescription>{description}</AccordionDescription>}
        </AccordionBody>
        <AccordionSuffixIcon>{suffixIcon}</AccordionSuffixIcon>
      </AccordionTriggerPrimitive>
    </AccordionHeader>
  ),
);
AccordionTrigger.displayName = "AccordionTrigger";
