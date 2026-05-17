"use client";

import clsx from "clsx";
import { createContext, forwardRef, useContext } from "react";
import type * as React from "react";
import { jsx } from "react/jsx-runtime";

type SlotRecipe<
  Props extends Record<string, string | boolean | undefined>,
  Classnames extends Record<string, string>,
> = ((props?: Props) => Classnames) & {
  splitVariantProps: <T extends Props>(props: T) => [Props, Omit<T, keyof Props>];
};

export function createSlotRecipeContext<
  Props extends Record<string, string | boolean | undefined>,
  Classnames extends Record<string, string>,
>(recipe: SlotRecipe<Props, Classnames>) {
  const ClassNamesContext = createContext<Classnames | null>(null);
  const PropsContext = createContext<Props | null>(null);

  const ClassNamesProvider = ({ children, value }: { children: React.ReactNode; value: Classnames }) =>
    jsx(ClassNamesContext.Provider, { value, children });

  const PropsProvider = ({ children, value }: { children: React.ReactNode; value: Props }) =>
    jsx(PropsContext.Provider, { value, children });

  function useClassNames(): Classnames {
    const ctx = useContext(ClassNamesContext);
    if (ctx === null)
      throw new Error("useClassNames must be used within a ClassNamesProvider.");
    return ctx;
  }

  function useProps(): Props | null {
    return useContext(PropsContext);
  }

  const withProvider = <T, P extends object>(
    Component: React.ElementType,
    slot: keyof Classnames,
    options?: { defaultProps?: Partial<P> },
  ) => {
    const { defaultProps } = options ?? {};
    const StyledComponent = forwardRef<T, P>((innerProps, ref) => {
      const props = { ...defaultProps, ...useProps(), ...innerProps } as unknown as P & Props;
      const [variantProps, otherProps] = recipe.splitVariantProps(props as Props);
      const classNames = recipe(variantProps);
      const className = classNames[slot as string];
      return jsx(ClassNamesProvider, {
        value: classNames,
        children: jsx(Component, {
          ref,
          ...otherProps,
          className: clsx(className, (props as { className?: string }).className),
        }),
      });
    });
    return StyledComponent;
  };

  const withContext = <T, P extends { className?: string }>(
    Component: React.ElementType,
    slot: keyof Classnames,
  ) => {
    const StyledComponent = forwardRef<T, P>((props, ref) => {
      const classNames = useClassNames();
      const className = classNames[slot as string];
      return jsx(Component, {
        ref,
        ...props,
        className: clsx(className, props.className),
      });
    });
    return StyledComponent;
  };

  return { ClassNamesProvider, PropsProvider, useClassNames, useProps, withProvider, withContext };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWithStateProps(useContexts: Array<(opts?: any) => { stateProps?: Record<string, unknown> } | null | undefined>) {
  return function withStateProps<T, P extends object>(Component: React.ElementType) {
    const Node = forwardRef<T, P>((props, ref) => {
      const stateProps: Record<string, unknown> = {};
      for (const useCtx of useContexts) {
        Object.assign(stateProps, useCtx({ strict: true })?.stateProps);
      }
      return jsx(Component, { ref, ...stateProps, ...props });
    });
    return Node;
  };
}
