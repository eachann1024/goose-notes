/**
 * uTools 对话框抽象层
 * 封装 showSaveDialog，非 uTools 环境返回 null。
 */

function getUTools(): any | null {
  if (typeof window !== "undefined" && typeof (window as any).utools !== "undefined") {
    return (window as any).utools;
  }
  return null;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * 打开"保存文件"对话框。
 * 返回用户选择的路径字符串，取消时返回 null，不可用时返回 null。
 */
async function showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
  const utools = getUTools();
  if (!utools || typeof utools.showSaveDialog !== "function") {
    return null;
  }

  const result = await Promise.resolve(utools.showSaveDialog(options ?? {}));
  return normalizeSavePath(result);
}

function normalizeSavePath(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" && first.trim().length > 0 ? first : null;
  }
  if (value && typeof value === "object") {
    const obj = value as { filePath?: unknown; canceled?: unknown };
    if (obj.canceled) return null;
    if (typeof obj.filePath === "string" && obj.filePath.trim().length > 0) {
      return obj.filePath;
    }
  }
  return null;
}

export const dialogs = {
  showSaveDialog,
};
