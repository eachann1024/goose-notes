/**
 * 内部资源引用：att: / att-file: / att-video: / uuid:
 * att-file: 和 att-video: 都以 att 开头，但不匹配 startsWith("att:")。
 */

export const INTERNAL_ASSET_REF_PREFIXES = [
  "att:",
  "att-file:",
  "att-video:",
  "uuid:",
] as const;

export function isInternalAssetRef(ref: string): boolean {
  return INTERNAL_ASSET_REF_PREFIXES.some((prefix) => ref.startsWith(prefix));
}
