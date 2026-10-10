import type { StoreSet, StoreGet } from "../hydrate";
import { DEFAULT_NOTEBOOK, useNotebooks } from "../../../useNotebooks";
import { isElectronHostTarget } from "./onboarding";
import { flushEditorContent } from "../flushEditor";
import { useSettings } from "@/stores/useSettings";
import { pickRandomPageIcon } from "@/lib/randomPageIcon";
import { focusNewPage, clonePageContent } from "./content";
import type { Page } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { persistPageSnapshot } from "../../persistence";

export const createPageAction = (
  set: StoreSet,
  get: StoreGet,
  parentId?: string,
  workspaceId = DEFAULT_NOTEBOOK,
  id?: string,
): string => {
  // Electron 仅本地文件夹模式：非 local-folder 工作区禁止建页（内置数据层关闭）
  if (isElectronHostTarget()) {
    const target = useNotebooks.getState().notebooks[workspaceId];
    if (target?.source !== "local-folder") return "";
  }
  flushEditorContent();

  const notebook = useNotebooks.getState().notebooks[workspaceId];
  const icon = useSettings.getState().randomIconOnCreate
    ? pickRandomPageIcon()
    : undefined;

  const finalId = get().createPageRecord({
    workspaceId,
    parentId,
    id,
    ...(icon ? { icon } : {}),
  });
  set({ activePageId: finalId });
  useNotebooks.getState().setLastActivePage(workspaceId, finalId);
  focusNewPage(finalId, true);

  return finalId;
};

export const createPageRecordAction = (
  set: StoreSet,
  get: StoreGet,
  options: {
    workspaceId: string;
    parentId?: string;
    id?: string;
  } & Partial<Page>,
): string => {
  const { workspaceId, parentId, id, content, ...extra } = options;
  // Electron 仅本地文件夹模式：拒绝写入内置工作区（含 AI / MCP 通路）
  if (isElectronHostTarget()) {
    const notebook = useNotebooks.getState().notebooks[workspaceId];
    if (notebook?.source !== "local-folder") return "";
  }
  const finalId = id || uuidv4();
  const now = Date.now();
  const newPage: Page = {
    id: finalId,
    workspaceId,
    parentId,
    content: clonePageContent(content),
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: now,
    updatedAt: now,
    order: now,
    ...extra,
  };

  set((state) => ({
    pages: { ...state.pages, [finalId]: newPage },
  }));

  persistPageSnapshot(get().pages[finalId]);
  return finalId;
};
