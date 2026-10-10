import { isDiskContentMatchingSnapshot } from "@/lib/local-md-snapshot";

export async function hasExternalDiskChange(
  filePath: string,
  pageId: string,
  source: "pre-save" | "pre-write",
): Promise<boolean> {
  try {
    let diskCurrentContent: string | null = null;
    if (window.gooseFs?.readFileStatAsync) {
      const r = await window.gooseFs.readFileStatAsync(filePath);
      diskCurrentContent = r.ok ? (r.content ?? "") : null;
    } else if (window.gooseFs?.readFileStat) {
      const r = window.gooseFs.readFileStat(filePath);
      diskCurrentContent = r.ok ? (r.content ?? "") : null;
    } else if (window.gooseFs?.readFileAsync) {
      diskCurrentContent = await window.gooseFs.readFileAsync(filePath);
    } else if (window.gooseFs?.readFile) {
      diskCurrentContent = window.gooseFs.readFile(filePath);
    }

    if (
      diskCurrentContent !== null &&
      !isDiskContentMatchingSnapshot(filePath, diskCurrentContent)
    ) {
      window.dispatchEvent(
        new CustomEvent("goose-note:local-file-conflict", {
          detail: { pageId, filePath, source },
        }),
      );
      return true;
    }
  } catch {
    // 读磁盘失败时放行（网络文件系统等异常情况下不阻断写盘）
  }
  return false;
}
