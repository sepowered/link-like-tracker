"use client";

/**
 * @file ui:menu
 * @requires @seed-design/react-menu@~0.0.0-alpha
 * @requires @seed-design/css@~0.0.0-alpha
 * @see https://alpha.seed-design.pages.dev/react/components/menu
 */

import { menu, type MenuVariantProps } from "@seed-design/css/recipes/menu";
import { menuItem, type MenuItemVariantProps } from "@seed-design/css/recipes/menu-item";
import {
  Menu as MenuPrimitive,
  useMenuContext,
  useMenuItemContext,
  type MenuContentProps as MenuContentPrimitiveProps,
  type MenuGroupLabelProps as MenuGroupLabelPrimitiveProps,
  type MenuGroupProps as MenuGroupPrimitiveProps,
  type MenuItemProps as MenuItemPrimitiveProps,
  type MenuPositionerProps as MenuPositionerPrimitiveProps,
  type MenuRootProps as MenuRootPrimitiveProps,
} from "@seed-design/react-menu";
import { Primitive, type PrimitiveProps } from "@seed-design/react-primitive";
import { PrefixIcon, SuffixIcon } from "@seed-design/react";
import clsx from "clsx";
import * as React from "react";
import { createSlotRecipeContext, createWithStateProps } from "@/lib/seed-design-recipe-utils";

const {
  ClassNamesProvider,
  PropsProvider,
  withProvider: withMenuProvider,
  withContext: withMenuContext,
  useClassNames: useMenuClassNames,
  useProps: useMenuProps,
} = createSlotRecipeContext(menu);

const {
  PropsProvider: ItemPropsProvider,
  withProvider: withItemProvider,
  withContext: withItemContext,
  ClassNamesProvider: ItemClassNamesProvider,
  useClassNames: useItemClassNames,
  useProps: useItemProps,
} = createSlotRecipeContext(menuItem);

const withMenuStateProps = createWithStateProps([useMenuContext]);
const withItemStateProps = createWithStateProps([useMenuItemContext]);

////////////////////////////////////////////////////////////////////////////////////

export interface MenuRootProps extends MenuVariantProps, MenuRootPrimitiveProps {}

export const MenuRoot = (props: MenuRootProps) => {
  const [variantProps, otherProps] = menu.splitVariantProps(props);
  const classNames = menu(variantProps);
  return (
    <ClassNamesProvider value={classNames}>
      <ItemPropsProvider value={{ size: variantProps.size }}>
        <MenuPrimitive.Root {...otherProps} />
      </ItemPropsProvider>
    </ClassNamesProvider>
  );
};
MenuRoot.displayName = "MenuRoot";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuAnchorProps extends MenuPrimitive.AnchorProps {}
export const MenuAnchor = MenuPrimitive.Anchor;

////////////////////////////////////////////////////////////////////////////////////

export interface MenuTriggerProps extends MenuPrimitive.TriggerProps {}
export const MenuTrigger = MenuPrimitive.Trigger;

////////////////////////////////////////////////////////////////////////////////////

export interface MenuPositionerProps extends MenuPositionerPrimitiveProps {}

export const MenuPositioner = React.forwardRef<HTMLDivElement, MenuPositionerProps>(
  ({ className, ...props }, ref) => {
    const classNames = useMenuClassNames();
    return (
      <MenuPrimitive.Positioner
        ref={ref}
        className={clsx(classNames.positioner, className)}
        {...props}
      />
    );
  },
);
MenuPositioner.displayName = "MenuPositioner";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuScrollAreaProps extends PrimitiveProps, React.HTMLAttributes<HTMLDivElement> {}

export const MenuScrollArea = withMenuContext<HTMLDivElement, MenuScrollAreaProps>(
  withMenuStateProps(Primitive.div),
  "scrollArea",
);
MenuScrollArea.displayName = "MenuScrollArea";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuContentBaseProps extends MenuContentPrimitiveProps {}

export const MenuContentBase = withMenuContext<HTMLDivElement, MenuContentBaseProps>(
  MenuPrimitive.Content,
  "content",
);
MenuContentBase.displayName = "MenuContentBase";

export interface MenuContentProps extends MenuContentPrimitiveProps {
  positionerContainer?: MenuPositionerPrimitiveProps["container"];
}

export const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(
  ({ children, positionerContainer, ...props }, ref) => (
    <MenuPrimitive.Positioner container={positionerContainer}>
      <MenuContentBase ref={ref} {...props}>
        <MenuScrollArea>{children}</MenuScrollArea>
      </MenuContentBase>
    </MenuPrimitive.Positioner>
  ),
);
MenuContent.displayName = "MenuContent";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuGroupProps extends MenuGroupPrimitiveProps {}
export const MenuGroup = withMenuContext<HTMLDivElement, MenuGroupProps>(
  MenuPrimitive.Group,
  "group",
);
MenuGroup.displayName = "MenuGroup";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuGroupLabelProps extends MenuGroupLabelPrimitiveProps {}
export const MenuGroupLabel = withMenuContext<HTMLDivElement, MenuGroupLabelProps>(
  MenuPrimitive.GroupLabel,
  "groupLabel",
);
MenuGroupLabel.displayName = "MenuGroupLabel";

////////////////////////////////////////////////////////////////////////////////////

export interface MenuItemBodyProps extends PrimitiveProps, React.HTMLAttributes<HTMLDivElement> {}

const MenuItemBody = withItemContext<HTMLDivElement, MenuItemBodyProps>(
  withItemStateProps(Primitive.div),
  "body",
);

export interface MenuItemLabelProps extends PrimitiveProps, React.HTMLAttributes<HTMLSpanElement> {}

const MenuItemLabel = withItemContext<HTMLSpanElement, MenuItemLabelProps>(
  withItemStateProps(Primitive.span),
  "label",
);

export interface MenuItemDescriptionProps extends PrimitiveProps, React.HTMLAttributes<HTMLSpanElement> {}

const MenuItemDescription = withItemContext<HTMLSpanElement, MenuItemDescriptionProps>(
  withItemStateProps(Primitive.span),
  "description",
);

////////////////////////////////////////////////////////////////////////////////////

export interface MenuItemProps extends MenuItemVariantProps, Omit<MenuItemPrimitiveProps, "children"> {
  prefixIcon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ prefixIcon, label, description, suffixIcon, className: propClassName, ...props }, ref) => {
    const [variantProps, otherProps] = menuItem.splitVariantProps(props);
    const parentProps = useItemProps();
    const classNames = menuItem({ ...parentProps, ...variantProps });
    return (
      <ItemClassNamesProvider value={classNames}>
        <MenuPrimitive.Item
          ref={ref}
          className={clsx(classNames.root, propClassName)}
          {...otherProps}
        >
          {prefixIcon && <PrefixIcon svg={prefixIcon} />}
          <MenuItemBody>
            <MenuItemLabel>{label}</MenuItemLabel>
            {description && <MenuItemDescription>{description}</MenuItemDescription>}
          </MenuItemBody>
          {suffixIcon && <SuffixIcon svg={suffixIcon} />}
        </MenuPrimitive.Item>
      </ItemClassNamesProvider>
    );
  },
);
MenuItem.displayName = "MenuItem";
