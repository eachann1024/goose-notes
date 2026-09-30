/**
 * 行内代码相对路径 tag。
 *
 * 本地文件夹笔记本里，行内代码内容是 ./ 或 ../ 开头的相对路径、解析后落在
 * 笔记本根目录内且磁盘上真实存在时，用 Decoration.inline 加
 * `goose-inline-code-path` class；按住 Cmd/Ctrl 时 hover 出下划线扫动动效，
 * 点击经 hostContext.onOpenAttachment 走 openResourceExternally 打开。
 *
 * 热路径保护：不在 apply 里同步全文档扫描；doc 变化或探测回填后统一走
 * 200ms 去抖重扫，结果经自定义 meta 事务写回（addToHistory: false）。
 */
import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import {
  isInsideRoot,
  peekProbe,
  probePath,
  resolveCandidatePath,
  toMarkdownTarget,
} from "@/components/editor/inline-code/localPathTarget";

export type InlineCodePathTagDeps = {
  getPageLocalFilePath: () => string | null;
  getLocalFolderRoot: () => string | null;
  existsAsync: (path: string) => Promise<boolean>;
  isFsAvailable: () => boolean;
  openPath: (rawText: string) => void;
};

type PathTagState = {
  decorations: DecorationSet;
};

const pathTagKey = new PluginKey<PathState>("goose-inline-code-path-tag");
type PathState = PathTagState;

const ARMED_CLASS = "goose-inline-code-path-armed";
const RESCAN_DEBOUNCE_MS = 200;

/** 收集带 code mark 的连续文本区间（相邻同 mark 的 text 节点合并成一段）。 */
function collectCodeRanges(doc: PMNode): Array<{ from: number; to: number; text: string }> {
  const codeType = doc.type.schema.marks.code;
  if (!codeType) return [];
  const ranges: Array<{ from: number; to: number; text: string }> = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (!codeType.isInSet(node.marks)) return;
    const last = ranges[ranges.length - 1];
    if (last && last.to === pos) {
      last.to = pos + node.text.length;
      last.text += node.text;
    } else {
      ranges.push({ from: pos, to: pos + node.text.length, text: node.text });
    }
  });
  return ranges;
}

function buildDecorations(
  doc: PMNode,
  deps: InlineCodePathTagDeps,
  onSettled: () => void,
): DecorationSet {
  const pagePath = deps.getPageLocalFilePath();
  const root = deps.getLocalFolderRoot();
  if (!pagePath || !root || !deps.isFsAvailable()) {
    return DecorationSet.empty;
  }
  const decorations: Decoration[] = [];
  for (const range of collectCodeRanges(doc)) {
    // 候选文本先补成 Markdown 目标（无扩展名追加 .md），再解析探测。
    const target = toMarkdownTarget(range.text);
    if (!target) continue;
    const absPath = resolveCandidatePath(target, pagePath);
    if (!absPath) continue;
    // 安全边界：越出笔记本根目录一律不渲染 tag（无声）。
    if (!isInsideRoot(absPath, root)) continue;
    const state = peekProbe(absPath);
    if (state === "hit") {
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: "goose-inline-code-path",
        }),
      );
    } else if (state === "unknown") {
      probePath(absPath, deps.existsAsync, onSettled);
    }
  }
  return DecorationSet.create(doc, decorations);
}

function createPathTagPlugin(deps: InlineCodePathTagDeps) {
  return new Plugin<PathState>({
    key: pathTagKey,
    state: {
      init: () => ({ decorations: DecorationSet.empty }),
      apply(tr: Transaction, prev: PathState): PathState {
        const meta = tr.getMeta(pathTagKey) as
          | { decorations: DecorationSet }
          | undefined;
        if (meta) return { decorations: meta.decorations };
        if (tr.docChanged) {
          return { decorations: prev.decorations.map(tr.mapping, tr.doc) };
        }
        return prev;
      },
    },
    props: {
      decorations(state: EditorState) {
        return pathTagKey.getState(state)?.decorations ?? null;
      },
      handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
        if (!event.metaKey && !event.ctrlKey) return false;
        const target = event.target as HTMLElement | null;
        const tag = target?.closest<HTMLElement>(".goose-inline-code-path");
        if (!tag) return false;
        const rawText = tag.textContent?.trim() ?? "";
        if (!rawText) return false;
        // DOM 里是用户写的原始文本（可能无后缀），必须补成 .md 目标再交给宿主。
        const mdTarget = toMarkdownTarget(rawText);
        if (!mdTarget) return false;
        event.preventDefault();
        deps.openPath(mdTarget);
        return true;
      },
    },
    view(view: EditorView) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let destroyed = false;
      // 基路径/根目录走 ref 运行时变化，笔记重命名或移动时 doc 不变也要重扫。
      let lastPagePath = deps.getPageLocalFilePath();
      let lastFolderRoot = deps.getLocalFolderRoot();

      const scheduleRescan = () => {
        if (destroyed) return;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          if (destroyed) return;
          const decorations = buildDecorations(
            view.state.doc,
            deps,
            scheduleRescan,
          );
          view.dispatch(
            view.state.tr
              .setMeta(pathTagKey, { decorations })
              .setMeta("addToHistory", false),
          );
        }, RESCAN_DEBOUNCE_MS);
      };

      // 首次挂载异步扫一次（init 不同步遍历文档）。
      scheduleRescan();

      const syncArmed = (event: KeyboardEvent) => {
        view.dom.classList.toggle(
          ARMED_CLASS,
          event.metaKey || event.ctrlKey,
        );
      };
      const disarm = () => view.dom.classList.remove(ARMED_CLASS);
      const onVisibility = () => {
        if (document.hidden) disarm();
      };
      window.addEventListener("keydown", syncArmed);
      window.addEventListener("keyup", syncArmed);
      window.addEventListener("blur", disarm);
      document.addEventListener("visibilitychange", onVisibility);

      return {
        update(view: EditorView, prevState: EditorState) {
          // 文档或基路径/根目录变化时安排去抖重扫；meta 事务本身不重复触发。
          const nextPagePath = deps.getPageLocalFilePath();
          const nextFolderRoot = deps.getLocalFolderRoot();
          if (
            view.state.doc !== prevState.doc ||
            nextPagePath !== lastPagePath ||
            nextFolderRoot !== lastFolderRoot
          ) {
            lastPagePath = nextPagePath;
            lastFolderRoot = nextFolderRoot;
            scheduleRescan();
          }
        },
        destroy() {
          destroyed = true;
          if (timer !== null) clearTimeout(timer);
          window.removeEventListener("keydown", syncArmed);
          window.removeEventListener("keyup", syncArmed);
          window.removeEventListener("blur", disarm);
          document.removeEventListener("visibilitychange", onVisibility);
          view.dom.classList.remove(ARMED_CLASS);
        },
      };
    },
  });
}

export function createInlineCodePathTagExtension(deps: InlineCodePathTagDeps) {
  return createExtension({
    key: "goose-inline-code-path-tag",
    // handleClick 按插件顺序短路：必须抢在 inlineCodeCaret 之前处理 Cmd/Ctrl 点击。
    runsBefore: ["goose-inline-code-caret"],
    prosemirrorPlugins: [createPathTagPlugin(deps)],
  });
}
