import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pin, PinOff, X, Save, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useNotebooks } from "@/stores/useNotebooks";
import {
  useQuickNote,
  buildQuickNoteDraftPage,
  QUICKNOTE_MIN_WIDTH,
  QUICKNOTE_MIN_HEIGHT,
} from "@/stores/useQuickNote";
import { EditorHostBridge } from "@/pages/workspace/components/editor-host/EditorHostBridge";
import { Editor, type EditorRef } from "@/components/editor/core/Editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toaster } from "@/components/ui/sonner";
import { quickNoteWindow } from "@/lib/utools/quickNoteWindow";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";

// 速记小窗砍掉的斜杠菜单重型项（按 title 精确匹配），保留标题/列表/待办/引用/标注/代码/分隔线。
const QUICKNOTE_HIDDEN_SLASH_ITEMS = [
  "生成",
  "表格",
  "数学公式",
  "Mermaid 图表",
  "图片",
  "文件",
];

// 编辑界面缩放（Cmd +/-）范围与步进。
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

/**
 * 速记小窗根组件（独立窗口进程）。
 *
 * 小窗是「草稿便签」：不直接对应一条真实笔记，编辑内容只落到草稿存储（useQuickNote.draftContent），
 * 不写进 pages、不进笔记列表 / 搜索、不自动存盘成文件。用户点左上角「保存到笔记本」才把草稿
 * 整体入库成一条真实笔记，随后清空草稿、回到空白便签。
 *
 * 复用主应用的编辑器内核：通过 <EditorHostBridge page={draftPage} onContentChangeOverride>
 * 注入草稿 page + 平台能力，再渲染 <Editor>。不渲染侧栏/标签栏/大纲——小窗只有编辑区。
 */
export function QuickNoteApp() {
  const editorRef = useRef<EditorRef>(null);

  const pinned = useQuickNote((s) => s.pinned);
  const setPinned = useQuickNote((s) => s.setPinned);
  const draftContent = useQuickNote((s) => s.draftContent);
  const setDraftContent = useQuickNote((s) => s.setDraftContent);
  const saveDraftToNotebook = useQuickNote((s) => s.saveDraftToNotebook);
  const setWindowWidth = useQuickNote((s) => s.setWindowWidth);
  const setWindowHeight = useQuickNote((s) => s.setWindowHeight);

  // 编辑界面缩放比例（会话态，Cmd +/- 调整）。
  const [zoom, setZoom] = useState(1);

  // 草稿 page：基于持久化的 draftContent 现造，作为编辑器初始内容。
  // 仅在首帧 / 进程内构造一次（key 随之固定），避免每次草稿落库 setState 重建编辑器。
  // draftContent 的后续变更由编辑器内部维护，不回灌——回灌会打断输入。
  const [draftPage] = useState(() => buildQuickNoteDraftPage(draftContent));

  // 失焦隐藏的宽限期截止时间戳：开窗 / 重新唤起后短时间内忽略 blur，
  // 避免主窗 hideMainWindow 造成的瞬时焦点切换把刚弹出的小窗立刻收掉。
  const blurGraceUntilRef = useRef<number>(0);
  const armBlurGrace = () => {
    blurGraceUntilRef.current = performance.now() + 600;
  };

  // 草稿内容变更：写入草稿存储（持久化），不落 page、不进列表。
  const onDraftChange = (content: BlockNoteContent) => {
    setDraftContent(content as never);
  };

  // 保存到笔记本：草稿入库成真实笔记 → 提示 → 清空草稿 → 重置编辑器为空白。
  const handleSave = () => {
    const id = saveDraftToNotebook();
    if (id) {
      toast.success("已保存到笔记本");
    } else {
      toast.info("便签是空的，没有需要保存的内容");
    }
    // 清空编辑器到空白便签：重置内容并聚焦。
    requestAnimationFrame(() => {
      editorRef.current?.editor?.replaceBlocks?.(
        editorRef.current.editor.document,
        buildQuickNoteDraftPage(null).content as never,
      );
      editorRef.current?.editor?.focus?.();
    });
  };

  // 首帧：进入宽限期 + 聚焦光标到编辑器。
  useEffect(() => {
    armBlurGrace();
    requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
  }, []);

  // 复用窗口：父窗以「速记」再次唤起已存在的小窗时（preload 发 quicknote:enter），
  // 重新聚焦即可（草稿延续，不重解析笔记）。
  useEffect(() => {
    const handler = () => {
      armBlurGrace();
      requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
    };
    window.addEventListener("goose-note:quicknote-enter", handler);
    return () =>
      window.removeEventListener("goose-note:quicknote-enter", handler);
  }, []);

  // 置顶状态变化时同步给窗口（preload 通过 utools 设置 alwaysOnTop / 失焦行为）。
  useEffect(() => {
    quickNoteWindow.setPinned(pinned);
  }, [pinned]);

  // 失焦自动隐藏（Raycast 核心手感）：钉住时不隐藏。
  useEffect(() => {
    const onBlur = () => {
      if (useQuickNote.getState().pinned) return;
      if (performance.now() < blurGraceUntilRef.current) return;
      quickNoteWindow.hide();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // 键盘：Esc 收起；Cmd +/- 缩放编辑界面（Cmd+0 复位）。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        quickNoteWindow.hide();
        return;
      }
      // 仅在按下 Cmd（macOS）/ Ctrl 时处理缩放。
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 窗口尺寸记忆：用户拖动窗口边框改宽高 → 记住最终尺寸，下次开窗沿用。
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // outerWidth/outerHeight 含窗口边框，是真实窗口尺寸。
        const w = window.outerWidth || window.innerWidth;
        const h = window.outerHeight || window.innerHeight;
        if (w >= QUICKNOTE_MIN_WIDTH) setWindowWidth(w);
        if (h >= QUICKNOTE_MIN_HEIGHT) setWindowHeight(h);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [setWindowWidth, setWindowHeight]);

  const isEditorFullWidth = useNotebooks((s) => {
    const nbId = s.activeNotebookId;
    const nb = nbId ? s.notebooks[nbId] : null;
    return nb?.editorFullWidth ?? false;
  });

  const headerBar = useMemo(
    () => (
      <div
        className="quicknote-titlebar flex h-9 shrink-0 items-center justify-between gap-1 px-2"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="保存到笔记本"
            title="保存到笔记本"
            className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            onClick={handleSave}
          >
            <Save className="h-3.5 w-3.5" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="使用说明"
                title="使用说明"
                className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              className="w-72 text-xs leading-relaxed"
            >
              <div className="mb-1.5 text-sm font-medium">速记便签 · 用法</div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <b className="text-foreground">草稿模式</b>
                  ：这里写的内容是临时草稿，不会自动成为笔记，也不写入文件。
                </li>
                <li>
                  <b className="text-foreground">保存到笔记本</b>
                  （左上角 <Save className="inline h-3 w-3 align-text-bottom" />）：把当前草稿存为一条正式笔记，随后清空便签。
                </li>
                <li>
                  <b className="text-foreground">置顶</b>
                  （右上角 <Pin className="inline h-3 w-3 align-text-bottom" />）：钉住后失焦不自动隐藏。
                </li>
                <li>
                  <b className="text-foreground">缩放</b>
                  ：⌘ + / ⌘ - 放大缩小编辑界面，⌘ 0 复位。
                </li>
                <li>
                  <b className="text-foreground">收起</b>
                  ：Esc 或点击窗口外即可隐藏，再次呼出草稿仍在。
                </li>
                <li>
                  <b className="text-foreground">尺寸记忆</b>
                  ：拖动边框调整的宽高会被记住，下次按此尺寸打开。
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={pinned ? "取消置顶" : "置顶"}
            className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            onClick={() => setPinned(!pinned)}
          >
            {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            aria-label="关闭"
            className="quicknote-titlebar-btn flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            onClick={() => quickNoteWindow.close()}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    ),
    // handleSave 闭包内只读 refs / store action，稳定，无需进依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinned, setPinned],
  );

  return (
    <div className="quicknote-root flex h-screen w-screen flex-col overflow-hidden bg-[hsl(var(--goose-editor-bg))]">
      {headerBar}
      <div className="min-h-0 flex-1 overflow-y-auto page-scroll-container">
        <EditorHostBridge
          page={draftPage}
          isEditorFullWidth={isEditorFullWidth}
          onContentChangeOverride={onDraftChange}
        >
          <div
            className="quicknote-editor-surface flex min-h-full flex-col pt-2"
            style={{ zoom } as CSSProperties}
          >
            <Editor
              ref={editorRef}
              editable
              hiddenSlashItemTitles={QUICKNOTE_HIDDEN_SLASH_ITEMS}
              showSideMenu={false}
            />
          </div>
        </EditorHostBridge>
      </div>
      <Toaster />
    </div>
  );
}
