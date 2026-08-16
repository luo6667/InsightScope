import clsx, { type ClassValue } from "clsx";

/** 企业常用 class 合并工具 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
