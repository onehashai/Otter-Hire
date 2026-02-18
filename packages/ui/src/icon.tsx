"use client";

import { icons, type LucideProps } from "lucide-react";
import { cn } from "./lib/utils";

export type IconName = keyof typeof icons;

export interface IconProps extends Omit<LucideProps, "ref"> {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const Icon = ({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 2,
  className,
  ...rest
}: IconProps) => {
  const LucideIcon = icons[name];

  if (!LucideIcon) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Icon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  return (
    <LucideIcon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
};
