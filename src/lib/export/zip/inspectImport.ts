import type JSZipNs from "jszip";
import type { NotebookImportInspection } from "./types";

/**
 * 在覆盖本地数据前只读校验导入包，确保它至少包含一份可恢复的记事本数据。
 * 该函数不会创建记事本、页面或历史记录。
 */
export async function inspectNotebookImportZip(
  zipBlob: Blob,
): Promise<NotebookImportInspection> {
  const { default: JSZip } = await import("jszip");
  let zip: JSZipNs;
  try {
    zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  } catch (error) {
    throw new Error("备份文件不是有效的 ZIP 包", { cause: error });
  }

  const metaFile = zip.file("backup-metadata.json");
  if (metaFile) {
    let meta: unknown;
    try {
      meta = JSON.parse(await metaFile.async("text"));
    } catch (error) {
      throw new Error("备份元数据已损坏", { cause: error });
    }

    if (!meta || typeof meta !== "object") {
      throw new Error("备份元数据格式无效");
    }
    const notebooks = (meta as { notebooks?: unknown }).notebooks;
    const pages = (meta as { pages?: unknown }).pages;
    if (
      !Array.isArray(notebooks) ||
      notebooks.length === 0 ||
      !Array.isArray(pages)
    ) {
      throw new Error("备份元数据缺少笔记本或页面列表");
    }
    if (
      notebooks.some((notebook) => {
        if (!notebook || typeof notebook !== "object") return true;
        const candidate = notebook as { id?: unknown; name?: unknown };
        return (
          typeof candidate.id !== "string" ||
          !candidate.id.trim() ||
          typeof candidate.name !== "string" ||
          !candidate.name.trim()
        );
      })
    ) {
      throw new Error("备份中包含无效的笔记本信息");
    }
    const notebookIds = new Set(
      notebooks.map((notebook) => (notebook as { id: string }).id),
    );
    if (
      pages.some((page) => {
        if (!page || typeof page !== "object") return true;
        const workspaceId = (page as { workspaceId?: unknown }).workspaceId;
        return (
          typeof workspaceId !== "string" ||
          !workspaceId.trim() ||
          !notebookIds.has(workspaceId)
        );
      })
    ) {
      throw new Error("备份中包含无效的页面信息");
    }
    return {
      source: "metadata",
      notebookCount: notebooks.length,
      pageCount: pages.length,
    };
  }

  const notebookNames = new Set<string>();
  let pageCount = 0;
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const parts = path.split("/");
    if (parts.length < 2 || parts[0] === "assets" || parts[1] === "assets")
      return;
    const extension = path.split(".").pop()?.toLowerCase();
    if (extension !== "md" && extension !== "json") return;
    notebookNames.add(parts[0]);
    pageCount += 1;
  });
  if (notebookNames.size === 0 || pageCount === 0) {
    throw new Error("ZIP 中没有可恢复的鹅的笔记数据");
  }
  return {
    source: "folders",
    notebookCount: notebookNames.size,
    pageCount,
  };
}
