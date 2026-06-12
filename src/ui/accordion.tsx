"use client";

/**
 * @file ui:accordion
 * @requires @seed-design/react-accordion@~0.0.0-alpha
 * @requires @seed-design/css@~0.0.0-alpha
 * @see https://alpha.seed-design.pages.dev/react/components/accordion
 */

import { accordion, type AccordionVariantProps } from "@seed-design/css/recipes/accordion";
import {
  AccordionContent as AccordionContentPrimitive,
  AccordionHeader as AccordionHeaderPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionRoot as AccordionRootPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
  useAccordionItemContext,
  type AccordionContentProps as AccordionContentPrimitiveProps,
  type AccordionHeaderProps as AccordionHeaderPrimitiveProps,
  type AccordionItemProps as AccordionItemPrimitiveProps,
  type AccordionRootProps as AccordionRootPrimitiveProps,
  type AccordionTriggerProps as AccordionTriggerPrimitiveProps,
} from "@seed-design/react-accordion";
import { Primitive, type PrimitiveProps } from "@seed-design/react-primitive";
import { Icon } from "@seed-design/react";
import { IconChevronDownLine } from "@karrotmarket/react-monochrome-icon";
import * as React from "react";
import { createSlotRecipeContext, createWithStateProps } from "@/lib/seed-design-recipe-utils";

const { withProvider, withContext } = createSlotRecipeContext(accordion);
const withStateProps = createWithStateProps([useAccordionItemContext]);

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionRootProps extends AccordionVariantProps, AccordionRootPrimitiveProps {}

export const AccordionRoot = withProvider<HTMLDivElement, AccordionRootProps>(
  AccordionRootPrimitive,
  "root",
);
AccordionRoot.displayName = "AccordionRoot";

export const Accordion = AccordionRoot;

////////////////////////////////////////////////////////////////////////////////////

export type AccordionItemProps = AccordionItemPrimitiveProps;

export const AccordionItem = withContext<HTMLDivElement, AccordionItemProps>(
  AccordionItemPrimitive,
  "item",
);
AccordionItem.displayName = "AccordionItem";

////////////////////////////////////////////////////////////////////////////////////

export type AccordionHeaderProps = AccordionHeaderPrimitiveProps;

export const AccordionHeader = withContext<HTMLHeadingElement, AccordionHeaderProps>(
  AccordionHeaderPrimitive,
  "header",
);
AccordionHeader.displayName = "AccordionHeader";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionBodyProps extends PrimitiveProps, React.HTMLAttributes<HTMLDivElement> {}

export const AccordionBody = withContext<HTMLDivElement, AccordionBodyProps>(Primitive.div, "body");
AccordionBody.displayName = "AccordionBody";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionTitleProps extends PrimitiveProps, React.HTMLAttributes<HTMLSpanElement> {}

export const AccordionTitle = withContext<HTMLSpanElement, AccordionTitleProps>(
  withStateProps(Primitive.span),
  "title",
);
AccordionTitle.displayName = "AccordionTitle";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionDescriptionProps
  extends PrimitiveProps,
    React.HTMLAttributes<HTMLSpanElement> {}

export const AccordionDescription = withContext<HTMLSpanElement, AccordionDescriptionProps>(
  withStateProps(Primitive.span),
  "description",
);
AccordionDescription.displayName = "AccordionDescription";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionPrefixProps extends PrimitiveProps, React.HTMLAttributes<HTMLDivElement> {}

export const AccordionPrefix = withContext<HTMLDivElement, AccordionPrefixProps>(
  withStateProps(Primitive.div),
  "prefix",
);
AccordionPrefix.displayName = "AccordionPrefix";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionSuffixIconProps
  extends PrimitiveProps,
    React.HTMLAttributes<HTMLDivElement> {}

export const AccordionSuffixIcon = withContext<HTMLDivElement, AccordionSuffixIconProps>(
  withStateProps(Primitive.div),
  "suffixIcon",
);
AccordionSuffixIcon.displayName = "AccordionSuffixIcon";

////////////////////////////////////////////////////////////////////////////////////

export type AccordionContentProps = AccordionContentPrimitiveProps;

export const AccordionContent = withContext<HTMLDivElement, AccordionContentProps>(
  AccordionContentPrimitive,
  "content",
);
AccordionContent.displayName = "AccordionContent";

////////////////////////////////////////////////////////////////////////////////////

export interface AccordionTriggerProps extends Omit<AccordionTriggerPrimitiveProps, "title" | "prefix"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  prefix?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

const StyledTrigger = withContext<HTMLButtonElement, AccordionTriggerPrimitiveProps>(
  AccordionTriggerPrimitive,
  "trigger",
);

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  (
    { title, description, prefix, suffixIcon = <Icon svg={<IconChevronDownLine />} />, headingLevel, ...rest },
    ref,
  ) => (
    <AccordionHeader headingLevel={headingLevel}>
      <StyledTrigger ref={ref} {...rest}>
        {prefix && <AccordionPrefix>{prefix}</AccordionPrefix>}
        <AccordionBody>
          <AccordionTitle>{title}</AccordionTitle>
          {description && <AccordionDescription>{description}</AccordionDescription>}
        </AccordionBody>
        <AccordionSuffixIcon>{suffixIcon}</AccordionSuffixIcon>
      </StyledTrigger>
    </AccordionHeader>
  ),
);
AccordionTrigger.displayName = "AccordionTrigger";
