/** 磁盘写入失败。把 EACCES 等底层错误收成可展示的中文说明。 */

export class DiskWriteError extends Error {
  readonly code?: string;
  readonly path?: string;

  constructor(
    message: string,
    options?: { code?: string; path?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "DiskWriteError";
    this.code = options?.code;
    this.path = options?.path;
  }
}

let lastWriteFailure: DiskWriteError | null = null;

export function rememberDiskWriteFailure(error: DiskWriteError): void {
  lastWriteFailure = error;
}

export function consumeDiskWriteFailure(): DiskWriteError | null {
  const error = lastWriteFailure;
  lastWriteFailure = null;
  return error;
}

function toText(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message.trim() : "";
  }
  return "";
}

function extractCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim().toUpperCase();
  }
  const text = toText(error);
  const match = text.match(/\b(EACCES|EPERM|EROFS|ENOSPC|ENOENT|EBUSY|EIO|EAGAIN)\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function mentionsCloud(text: string): boolean {
  return /icloud|fuse\.driver|onedrive|dropbox|google.?drive|megasync/i.test(
    text,
  );
}

export function toDiskWriteError(
  error: unknown,
  path?: string,
): DiskWriteError {
  if (error instanceof DiskWriteError) return error;
  const code = extractCode(error);
  return new DiskWriteError(describeDiskWriteError(error, path), {
    code: code || undefined,
    path,
    cause: error,
  });
}

export function describeDiskWriteError(error: unknown, path?: string): string {
  if (error instanceof DiskWriteError && error.message) return error.message;

  const text = toText(error);
  const code = extractCode(error);
  const haystack = `${text} ${path ?? ""}`;
  const cloud = mentionsCloud(haystack);

  if (code === "EACCES" || code === "EPERM" || /permission denied/i.test(text)) {
    return cloud
      ? "笔记文件夹当前无法写入（权限不足）。若笔记在 iCloud 等云盘上，请先恢复云盘登录后再保存。"
      : "笔记文件夹当前无法写入（权限不足）。请检查系统文件夹权限后再保存。";
  }
  if (code === "EROFS" || /read-only file system/i.test(text)) {
    return "笔记文件夹处于只读状态，无法保存更改。";
  }
  if (code === "ENOSPC") {
    return "磁盘可用空间不足，无法保存更改，请清理空间后重试。";
  }
  if (code === "ENOENT") {
    return "保存路径不存在，所属文件夹可能已被移动或重命名。";
  }
  if (code === "EBUSY" || code === "EAGAIN") {
    return "文件系统正忙，请稍后重试保存。";
  }
  if (code === "EIO") {
    return "磁盘读写出错，请检查驱动器或云盘状态后重试。";
  }
  if (text.includes("本地页面保存未完成") || text.includes("manual save failed")) {
    return "笔记未能写入磁盘，请检查文件夹是否具备写入权限。";
  }
  if (text) return text;
  return "笔记未能写入磁盘，请重试。";
}
