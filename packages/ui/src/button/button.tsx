"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Icon } from "../icon";

import { cn } from "../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type TooltipContentProps = React.ComponentPropsWithoutRef<
  typeof TooltipContent
>;
type TooltipRootProps = React.ComponentPropsWithoutRef<typeof Tooltip>;
type TooltipProviderProps = React.ComponentPropsWithoutRef<
  typeof TooltipProvider
>;

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the button; keeps label text unchanged. */
  pending?: boolean;
  tooltip?: React.ReactNode;
  tooltipProps?: Omit<TooltipRootProps, "children">;
  tooltipContentProps?: Omit<TooltipContentProps, "children">;
  tooltipProviderProps?: TooltipProviderProps;
  ref?: React.Ref<HTMLButtonElement>;
}

function Button({
  ref,
  className,
  variant,
  size,
  asChild = false,
  pending = false,
  tooltip,
  tooltipProps,
  tooltipContentProps,
  tooltipProviderProps,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const useAsChild = asChild && !pending;
  const Comp = useAsChild ? Slot : "button";
  const isDisabled = Boolean(disabled) || pending;

  const buttonEl = (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={isDisabled}
      aria-busy={pending}
      {...props}
    >
      {pending ? (
        <span className="inline-flex max-w-full items-center justify-center gap-2">
          <Icon
            name="Loader"
            className="h-4 w-4 animate-spin shrink-0"
            aria-hidden
          />
          {children}
        </span>
      ) : (
        children
      )}
    </Comp>
  );

  if (tooltip == null || tooltip === "") {
    return buttonEl;
  }

  const triggerChild =
    isDisabled === true ? (
      <span className="inline-flex cursor-not-allowed">{buttonEl}</span>
    ) : (
      buttonEl
    );

  return (
    <TooltipProvider
      delayDuration={500}
      skipDelayDuration={300}
      {...tooltipProviderProps}
    >
      <Tooltip {...tooltipProps}>
        <TooltipTrigger asChild>{triggerChild}</TooltipTrigger>
        <TooltipContent {...tooltipContentProps}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
Button.displayName = "Button";

export { Button, buttonVariants };
