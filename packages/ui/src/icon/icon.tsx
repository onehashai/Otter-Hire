"use client";

import type { LucideProps } from "lucide-react";
import { iconMap, type IconName } from "./icon-map";
import { cn } from "../lib/utils";

export type { IconName };

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
  const LucideIcon = iconMap[name];
  if (!LucideIcon) return null;
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
