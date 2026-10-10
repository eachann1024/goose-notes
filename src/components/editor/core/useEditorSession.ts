import { useCallback, useEffect, useRef, useState } from "react";
import type { useCreateBlockNote } from "@blocknote/react";
import {
  useEditorSettings,
  useEditorPageContext,
} from "@/components/editor/platform/hostContext";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { markUserInteraction } from "@/lib/editor-interaction-signal";
import { rememberEditorSelectedBlocks } from "@/components/editor/utils/selection";
import { toEditorBlocks } from "./editorContentPolicy";

export function useEditorSession(editable: boolean) {
  const settings = useEditorSettings();
  const {
    theme,
    searchProviders,
    customActions,
    ai: aiSettings,
    openLinksInHost,
  } = settings;
  const {
    page,
    contentMode,
    isEditorFullWidth,
    onContentChange,
    onOpenPage,
    getActivePageLocalFilePath,
    getActivePageLocalFolderRoot,
    onOpenMarkdownPath,
    onOpenAttachment,
    getLatestPage,
  } = useEditorPageContext();
  const platform = useEditorPlatform();
  const activePageId = page?.id ?? null;

  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  // 只有 BlockNote 真正触发了待提交的 onChange 才需要在切页时克隆整篇文档。
  // 只读浏览后切到文件夹主页时直接跳过，避免大文件产生同步长任务。
  const pendingEditorChangeRef = useRef(false);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const shiftPressedRef = useRef(false);
  pageIdForUpdateRef.current = page?.id ?? null;

  // 点击编辑器空白区域消闪：mousedown 时短暂抑制格式化工具栏（prosemirror 会先短暂
  // 出现非空选区再被 focusEditorEnd 塌缩），mouseup 时恢复。
  const [suppressFormattingToolbar, setSuppressFormattingToolbar] =
    useState(false);
  const suppressFormattingToolbarRef = useRef(false);

  // 注入回调/数据的最新引用：供 useCreateBlockNote（deps=[]）的闭包与各 effect 读取，
  // 避免把 settings/pageContext 直接进依赖数组导致编辑器重建（行为不变）。
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onOpenPageRef = useRef(onOpenPage);
  onOpenPageRef.current = onOpenPage;
  const getActivePageLocalFilePathRef = useRef(getActivePageLocalFilePath);
  getActivePageLocalFilePathRef.current = getActivePageLocalFilePath;
  const getActivePageLocalFolderRootRef = useRef(getActivePageLocalFolderRoot);
  getActivePageLocalFolderRootRef.current = getActivePageLocalFolderRoot;
  const onOpenMarkdownPathRef = useRef(onOpenMarkdownPath);
  onOpenMarkdownPathRef.current = onOpenMarkdownPath;
  const onOpenAttachmentRef = useRef(onOpenAttachment);
  onOpenAttachmentRef.current = onOpenAttachment;
  const pageRef = useRef(page);
  pageRef.current = page;
  const contentModeRef = useRef(contentMode);
  contentModeRef.current = contentMode;
  const inlineAiScopeRef = useRef(() => ({
    pageId: "",
    editable: false,
    protectFirstTitle: true,
  }));
  inlineAiScopeRef.current = () => {
    const latest = getLatestPage ? getLatestPage(page.id) : page;
    return {
      pageId: page.id,
      editable: Boolean(
        latest &&
        editable &&
        !latest.isLocked &&
        !latest.trashedAt &&
        !(latest.localFilePath && latest.localReadState === "error"),
      ),
      protectFirstTitle: contentMode === "normalized",
    };
  };
  // platformRef 供 useCreateBlockNote 闭包（deps=[]）调用平台能力，
  // 同 aiSettingsRef 模式，避免闭包捕获旧 platform 引用。
  const platformRef = useRef(platform);
  platformRef.current = platform;
  const openLinksInHostRef = useRef(openLinksInHost);
  openLinksInHostRef.current = openLinksInHost;
  // settingsRef 供 useCreateBlockNote 闭包（deps=[]）调用平台设置，避免闭包捕获旧配置
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** uploadFile 与同 tick 粘贴需 getBlock；每 render 同步 */
  const editorInstanceRef = useRef<ReturnType<
    typeof useCreateBlockNote
  > | null>(null);

  // raw 文档保持宿主传入的块结构，不施加页面级标题和空正文规范；
  // normalized 文档沿用完整页面规范化规则。
  const usesRawEditorContent = contentMode === "raw";
  const usesRawEditorContentRef = useRef(usesRawEditorContent);
  usesRawEditorContentRef.current = usesRawEditorContent;
  const normalizeContent = (c: unknown): BlockNoteContent =>
    usesRawEditorContent
      ? toEditorBlocks(c)
      : normalizePageContent(c as Parameters<typeof normalizePageContent>[0]);

  // 用户意图门控（仅 raw 文档消费）：BlockNote 对部分块（折叠块/视频/带
  // 属性图片等）会在初始化后异步补全 props，触发与基线签名不一致的 onChange——
  // 这不是用户编辑，不应入保存队列。这里记录「自上次程序化同步以来用户是否真实
  // 交互过」：pointerdown/keydown/paste/cut/drop 任一发生即视为有交互（覆盖打字、
  // IME、点勾选框/工具栏/菜单、拖拽块、表格操作等全部真实编辑入口；误报无害——
  // 内容未变签名相等不会入队，变了还有写盘前 diff 兜底）。切页/外部重载后重置。
  const userInteractedRef = useRef(false);
  useEffect(() => {
    const markInteracted = (event: Event) => {
      userInteractedRef.current = true;
      markUserInteraction();
      const currentEditor = editorInstanceRef.current;
      if (!currentEditor || event.type !== "pointerdown") return;
      const target = event.target;
      const insideEditor =
        target instanceof Node &&
        Boolean(currentEditor.domElement?.contains(target));
      if (insideEditor) return;
      rememberEditorSelectedBlocks(currentEditor);
    };
    const events = ["pointerdown", "keydown", "paste", "cut", "drop"] as const;
    events.forEach((name) =>
      document.addEventListener(name, markInteracted, true),
    );
    return () =>
      events.forEach((name) =>
        document.removeEventListener(name, markInteracted, true),
      );
  }, []);

  // 程序化同步路径（非 silent 入队以外的 store 同步）：供 onChange 在「无用户交互」
  // 时把编辑器自动补全后的内容静默同步进 store（不标脏、不入保存队列、不刷 updatedAt）。
  const silentContentSync = useCallback((content: BlockNoteContent) => {
    onContentChangeRef.current(content, { silent: true });
  }, []);

  return {
    settings,
    theme,
    searchProviders,
    customActions,
    aiSettings,
    openLinksInHost,
    page,
    contentMode,
    isEditorFullWidth,
    onContentChange,
    onOpenPage,
    getActivePageLocalFilePath,
    getActivePageLocalFolderRoot,
    onOpenMarkdownPath,
    onOpenAttachment,
    getLatestPage,
    platform,
    activePageId,
    pageIdForUpdateRef,
    syncedContentSignatureRef,
    pendingEditorChangeRef,
    editorContainerRef,
    shiftPressedRef,
    suppressFormattingToolbar,
    setSuppressFormattingToolbar,
    suppressFormattingToolbarRef,
    aiSettingsRef,
    onContentChangeRef,
    onOpenPageRef,
    getActivePageLocalFilePathRef,
    getActivePageLocalFolderRootRef,
    onOpenMarkdownPathRef,
    onOpenAttachmentRef,
    pageRef,
    contentModeRef,
    inlineAiScopeRef,
    platformRef,
    openLinksInHostRef,
    settingsRef,
    editorInstanceRef,
    usesRawEditorContent,
    usesRawEditorContentRef,
    normalizeContent,
    userInteractedRef,
    silentContentSync,
  };
}

export type EditorSession = ReturnType<typeof useEditorSession>;
export type EditorRuntime = EditorSession & {
  editor: ReturnType<typeof useCreateBlockNote>;
};
