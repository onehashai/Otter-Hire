"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "../lib/utils";

function defaultFallbackLabel(alt: string | undefined | null): string {
  const t = alt?.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

export type AvatarProps = Omit<
  React.ComponentProps<typeof AvatarPrimitive.Root>,
  "children"
> & {
  src?: string | null;
  alt?: string;
  children?: React.ReactNode;
  imageClassName?: string;
  fallbackClassName?: string;
  ref?: React.Ref<HTMLSpanElement>;
};

function Avatar({ ref, className, src, alt, children, imageClassName, fallbackClassName, ...props }: AvatarProps) {
  const fallbackContent = children !== undefined ? children : defaultFallbackLabel(alt);
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={alt ?? ""}
          className={cn("aspect-square h-full w-full object-cover", imageClassName)}
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-muted",
          fallbackClassName,
        )}
      >
        {fallbackContent}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
Avatar.displayName = AvatarPrimitive.Root.displayName;

export { Avatar };
