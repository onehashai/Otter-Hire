import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a temporary ID for frontend form state (React keys, etc). No crypto needed. */
let _idCounter = 0;
export function generateId(): string {
  return `tmp-${++_idCounter}-${Date.now()}`;
}
