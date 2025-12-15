import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get current date in Malaysia timezone (UTC+8)
 * Returns date string in YYYY-MM-DD format
 */
export function getMalaysiaDate(): string {
  const now = new Date();
  const malaysiaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  return malaysiaTime.toISOString().split("T")[0];
}

/**
 * Get yesterday's date in Malaysia timezone (UTC+8)
 * Returns date string in YYYY-MM-DD format
 */
export function getMalaysiaYesterday(): string {
  const now = new Date();
  const malaysiaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  malaysiaTime.setDate(malaysiaTime.getDate() - 1);
  return malaysiaTime.toISOString().split("T")[0];
}
