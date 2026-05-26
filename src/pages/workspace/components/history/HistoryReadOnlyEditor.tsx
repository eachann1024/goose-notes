import { useEffect, useMemo, useState } from "react";
import { useCreateBlockNote, BlockNoteViewRaw as BlockNoteView } from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import "@blocknote/react/style.css";
import { useSettings } from "@/stores/useSettings";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  normalizePageContent,
  type BlockNoteContent,
} from "@/lib/blocknote-content";
import { editorSchema } from "@/pages/workspace/components/editor/EditorFindBar";
import { cn } from "@/lib/utils";

interface HistoryReadOnlyEditorProps {
  content: BlockNoteContent;
  /** 切换版本时强制重建编辑器（避免 initialContent 不同步） */
  versionKey: string;
}

/**
 * 只读 BlockNote 渲染器，专供历史模式右侧主区使用。
 *
 * 设计取舍：
 *  - 不复用 Editor.tsx：那是写态编辑器，绑死 usePages.activePageId、有 debouncedUpdate / file drop / shortcuts，
 *    在历史模式下这些副作用全是噪音。这里只要一个干净的只读渲染。
 *  - 用 versionKey 作为外层 key（在父组件 wrap），切版本即重建实例，避免 BlockNote 的 initialContent 只生效一次。
 *  - 不挂 SideMenu / FormattingToolbar / SlashMenu：只读不需要任何编辑控件。
 */
export function HistoryReadOnlyEditor({
  content,
  versionKey: _versionKey,
}: HistoryReadOnlyEditorProps) {
  const { globalEditorFullWidth, theme } = useSettings();
  const { activePageId } = usePages();
  const { notebooks } = useNotebooks();
  const activePage = activePageId ? usePages.getState().pages[activePageId] : null;
  const activeNotebook = activePage ? notebooks[activePage.workspaceId] : undefined;
  const isEditorFullWidth = Boolean(
    activeNotebook?.editorFullWidth ?? globalEditorFullWidth,
  );
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const resolve = () => {
      if (theme === "dark") return setEffectiveTheme("dark");
      if (theme === "system") {
        return setEffectiveTheme(
          window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        );
      }
      setEffectiveTheme("light");
    };
    resolve();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => resolve();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const normalized = useMemo(() => normalizePageContent(content), [content]);

  const editor = useCreateBlockNote({
    initialContent: normalized as any,
    schema: editorSchema,
    dictionary: zh,
    domAttributes: {
      editor: {
        class: "goose-blocknote-editor",
      },
    },
    // 与 Editor.tsx 保持一致：att:/本地路径/uuid: 都要能解析，否则历史版本的图片显示 broken
    resolveFileUrl: async (url) => {
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
      ) {
        return url;
      }
      const { isLocalFilePath, resolveToAbsolute, readLocalFileAsBlob } =
        await import("@/lib/imageStorage/strategies/file-system");
      if (isLocalFilePath(url)) {
        // 历史模式下读当前 page 的 localFilePath 作为相对路径基准
        const { usePages } = await import("@/stores/usePages");
        const activePageId = usePages.getState().activePageId;
        const activePage = activePageId ? usePages.getState().pages[activePageId] : null;
        if (activePage?.localFilePath) {
          const pageDir = activePage.localFilePath.replace(/[\\/][^\\/]+$/, "");
          const fullPath = resolveToAbsolute(pageDir, url);
          const blob = readLocalFileAsBlob(fullPath);
          if (blob) return URL.createObjectURL(blob);
        }
      }
      const { imageStorage } = await import("@/lib/imageStorage");
      const blob = await imageStorage.load(url);
      if (blob) return URL.createObjectURL(blob);
      return url;
    },
  });

  // 同步 isEditable（BlockNote 的 editable 在 view 上是 prop，editor 实例上也维护一份）
  useEffect(() => {
    editor.isEditable = false;
  }, [editor]);

  // 与主 Editor 在 WorkspaceLayout 内的包裹完全一致：max-w-4xl mx-auto / max-w-full
  // 父级（HistoryView 的 page-scroll-container 内）已经提供 px-8 / px-6 md:px-8 lg:px-10
  return (
    <div
      className={cn(
        "mt-1 pt-1 pb-12",
        isEditorFullWidth ? "max-w-full" : "w-full max-w-4xl mx-auto",
      )}
    >
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={effectiveTheme}
        slashMenu={false}
        formattingToolbar={false}
        sideMenu={false}
        tableHandles={false}
        filePanel={false}
      />
    </div>
  );
}
