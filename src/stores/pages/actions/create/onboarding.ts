import type { StoreSet, StoreGet } from "../hydrate";
import { DEFAULT_NOTEBOOK, useNotebooks } from "../../../useNotebooks";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { v4 as uuidv4 } from "uuid";
import type { Page } from "@/types";
import {
  ONBOARDING_PAGE_CONTENT,
  ONBOARDING_CHILD_PAGE_CONTENT,
  ONBOARDING_SECOND_CHILD_CONTENT,
  ONBOARDING_THIRD_CHILD_CONTENT,
} from "@/lib/onboarding";
import { persistPageSnapshots, persistPageSnapshot } from "../../persistence";
import { savePagesMeta } from "@/lib/storage/pageRepository";

// 宿主标记未注入时保留浏览器默认行为。
export const isElectronHostTarget = () =>
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

export const createOnboardingPagesAction = (set: StoreSet, get: StoreGet) => {
  // Electron 仅本地文件夹模式：无内置笔记本，不种新手引导页
  if (isElectronHostTarget()) return;
  let createdMainId: string | null = null;
  const workspaceId = DEFAULT_NOTEBOOK;

  set((state) => {
    const hasExistingOnboardingPage = Object.values(state.pages).some(
      (page) =>
        page.workspaceId === workspaceId &&
        !page.trashedAt &&
        extractTitleFromContent(page.content) === "鹅的笔记 · 新手指南",
    );

    if (state.onboardingCompleted || hasExistingOnboardingPage) {
      if (state.onboardingCompleted) return state;
      return { ...state, onboardingCompleted: true };
    }

    const mainId = uuidv4();
    const childId1 = uuidv4();
    const childId2 = uuidv4();
    const childId3 = uuidv4();
    const now = Date.now();

    createdMainId = mainId;

    const mainPage: Page = {
      id: mainId,
      workspaceId,
      parentId: undefined,
      content: ONBOARDING_PAGE_CONTENT,
      isFolder: false,
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: now,
      updatedAt: now,
      order: now,
    };

    const childPage1: Page = {
      id: childId1,
      workspaceId,
      parentId: mainId,
      content: ONBOARDING_CHILD_PAGE_CONTENT,
      isFolder: false,
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: now + 1,
      updatedAt: now + 1,
      order: now + 1,
    };

    const childPage2: Page = {
      id: childId2,
      workspaceId,
      parentId: mainId,
      content: ONBOARDING_SECOND_CHILD_CONTENT,
      isFolder: false,
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: now + 2,
      updatedAt: now + 2,
      order: now + 2,
    };

    const childPage3: Page = {
      id: childId3,
      workspaceId,
      parentId: mainId,
      content: ONBOARDING_THIRD_CHILD_CONTENT,
      isFolder: false,
      isLocked: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: now + 3,
      updatedAt: now + 3,
      order: now + 3,
    };

    return {
      ...state,
      pages: {
        ...state.pages,
        [mainId]: mainPage,
        [childId1]: childPage1,
        [childId2]: childPage2,
        [childId3]: childPage3,
      },
      activePageId: mainId,
      onboardingCompleted: true,
      expandPageId: mainId,
    };
  });

  if (createdMainId) {
    useNotebooks.getState().setActiveNotebook(workspaceId);
    useNotebooks.getState().setLastActivePage(workspaceId, createdMainId);
    const currentPages = get().pages;
    persistPageSnapshots(currentPages, [createdMainId]);
    Object.values(currentPages)
      .filter((page) => page.parentId === createdMainId)
      .forEach((page) => persistPageSnapshot(page));
  }
  savePagesMeta({ onboardingCompleted: true });
};
