import { toast } from "sonner";

import type { PluginEnterPayload } from "@/lib/utools/lifecycle";
import { usePages } from "@/stores/usePages";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { titleHeadingBlock } from "@/lib/blocknote-content";
import { buildClipBlocks, type ClipMeta, type ClipFileEntry } from "./buildClipBlocks";

const INBOX_TITLE = "📥 收件箱";

interface UToolsFilePayloadItem {
  isFile?: boolean;
  isDirectory?: boolean;
  name?: string;
  path?: string;
  type?: string;
  size?: number;
}

const toStringSafe = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

const ensureInboxPage = async (): Promise<{ notebookId: string; pageId: string } | null> => {
  const settings = useSettings.getState();
  const notebooksStore = useNotebooks.getState();
  const pagesStore = usePages.getState();

  const candidateNotebookId = settings.clipper.inboxNotebookId;
  const candidatePageId = settings.clipper.inboxPageId;

  // 已有完整的 inbox 配置，且记事本与页面都存在（且未删除）
  if (candidateNotebookId && candidatePageId) {
    const notebook = notebooksStore.notebooks[candidateNotebookId];
    const page = pagesStore.pages[candidatePageId];
    if (
      notebook &&
      notebook.source !== "local-folder" &&
      page &&
      !page.trashedAt &&
      page.workspaceId === candidateNotebookId
    ) {
      return { notebookId: candidateNotebookId, pageId: candidatePageId };
    }
  }

  // 选择目标记事本：优先用候选的，否则用默认记事本
  const targetNotebookId =
    candidateNotebookId &&
    notebooksStore.notebooks[candidateNotebookId] &&
    notebooksStore.notebooks[candidateNotebookId].source !== "local-folder"
      ? candidateNotebookId
      : DEFAULT_NOTEBOOK;

  // lazy 创建收件箱页面
  const inboxContent = [titleHeadingBlock(INBOX_TITLE)];
  const createdPageId = pagesStore.createPageRecord({
    workspaceId: targetNotebookId,
    content: inboxContent as any,
  });

  settings.setClipperInbox(targetNotebookId, createdPageId);

  return { notebookId: targetNotebookId, pageId: createdPageId };
};

const buildMetaFromText = (detail: PluginEnterPayload): ClipMeta | null => {
  const payload = detail.payload;
  const text = typeof payload === "string" ? payload : toStringSafe((payload as any)?.text);
  if (!text.trim()) return null;

  return {
    kind: "text",
    text,
    sourceUrl: detail.optional?.sourceUrl,
    sourceApp: detail.optional?.sourceApp,
    capturedAt: detail.optional?.capturedAt ?? Date.now(),
  };
};

const buildMetaFromImage = (detail: PluginEnterPayload): ClipMeta | null => {
  const payload = detail.payload;
  // uTools 截图 payload 通常是 base64 字符串（data URL 或纯 base64）
  let url: string | null = null;
  if (typeof payload === "string" && payload.trim()) {
    url = payload.startsWith("data:") ? payload : `data:image/png;base64,${payload}`;
  } else if (payload && typeof payload === "object" && typeof (payload as any).dataUrl === "string") {
    url = (payload as any).dataUrl;
  }
  if (!url) return null;

  const image: ClipFileEntry = {
    url,
    name: `clip-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
    mimeType: "image/png",
  };

  return {
    kind: "image",
    image,
    sourceUrl: detail.optional?.sourceUrl,
    sourceApp: detail.optional?.sourceApp,
    capturedAt: detail.optional?.capturedAt ?? Date.now(),
  };
};

const buildMetaFromFiles = (detail: PluginEnterPayload): ClipMeta | null => {
  const payload = detail.payload;
  if (!Array.isArray(payload)) return null;

  const files: ClipFileEntry[] = (payload as UToolsFilePayloadItem[])
    .filter((item) => item && item.path)
    .map((item) => ({
      url: `file://${item.path}`,
      name: item.name || (item.path?.split(/[\\/]/).pop() ?? "未命名文件"),
      mimeType: typeof item.type === "string" ? item.type : undefined,
      size: typeof item.size === "number" ? item.size : undefined,
    }));

  if (files.length === 0) return null;

  return {
    kind: "files",
    files,
    sourceUrl: detail.optional?.sourceUrl,
    sourceApp: detail.optional?.sourceApp,
    capturedAt: detail.optional?.capturedAt ?? Date.now(),
  };
};

const resolveMeta = (detail: PluginEnterPayload): ClipMeta | null => {
  const code = detail.code;
  const type = detail.type;
  if (code === "clip_text" || type === "over") {
    return buildMetaFromText(detail);
  }
  if (code === "clip_image" || type === "img") {
    return buildMetaFromImage(detail);
  }
  if (code === "clip_files" || type === "files") {
    return buildMetaFromFiles(detail);
  }
  if (code === "clip_quick") {
    // 快速入口不带 payload，仅打开收件箱
    return null;
  }
  return null;
};

export async function handleClip(detail: PluginEnterPayload): Promise<void> {
  try {
    const target = await ensureInboxPage();
    if (!target) {
      toast.error("剪藏失败：无法访问收件箱");
      return;
    }

    if (detail.code === "clip_quick") {
      // 仅打开收件箱页面
      usePages.getState().setActivePage(target.pageId);
      useNotebooks.getState().setActiveNotebook(target.notebookId);
      toast.success("已打开收件箱", { duration: 1500 });
      return;
    }

    const meta = resolveMeta(detail);
    if (!meta) {
      toast.error("剪藏内容为空");
      return;
    }

    const insertSourceMeta = useSettings.getState().clipper.insertSourceMeta;
    const blocks = buildClipBlocks(meta, { insertSourceMeta });
    if (blocks.length === 0) {
      toast.error("剪藏失败：无法构建内容");
      return;
    }

    const ok = await usePages
      .getState()
      .appendPageContent(target.pageId, blocks as any);

    if (!ok) {
      toast.error("剪藏失败");
      return;
    }

    const labelMap: Record<string, string> = {
      text: "文本",
      image: "图片",
      files: "附件",
    };
    const label = labelMap[meta.kind] ?? "内容";
    toast.success(`已剪藏${label}到收件箱`, { duration: 1500 });
  } catch (error) {
    console.error("[clipper] handleClip failed:", error);
    toast.error("剪藏失败");
  }
}
