import type { BlockNoteEditor } from "@blocknote/core";
import { FilePanelExtension } from "@blocknote/core/extensions";
import { AIExtension } from "@blocknote/xl-ai";
import { createRoot, type Root } from "react-dom/client";
import {
  CheckSquare,
  Code,
  FileUp,
  GitGraph,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Sparkles,
  Table,
  Video,
} from "lucide-react";
const SLASH_ICONS = {
  sparkles: <Sparkles size={18} />,
  heading1: <Heading1 size={18} />,
  heading2: <Heading2 size={18} />,
  heading3: <Heading3 size={18} />,
  check: <CheckSquare size={18} />,
  list: <List size={18} />,
  listOrdered: <ListOrdered size={18} />,
  quote: <Quote size={18} />,
  info: <Info size={18} />,
  minus: <Minus size={18} />,
  table: <Table size={18} />,
  code: <Code size={18} />,
  sigma: <Sigma size={18} />,
  mermaid: <GitGraph size={18} />,
  image: <Image size={18} />,
  video: <Video size={18} />,
  file: <FileUp size={18} />,
};

let slashIconWarmRoot: Root | null = null;

export function warmupSlashMenuIcons() {
  if (slashIconWarmRoot || typeof document === "undefined") return;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:0;top:0;width:40px;height:40px;opacity:0;pointer-events:none;overflow:hidden";
  document.body.appendChild(host);
  slashIconWarmRoot = createRoot(host);
  slashIconWarmRoot.render(
    <div>{Object.values(SLASH_ICONS)}</div>,
  );
}

export interface SlashMenuItem {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  aliases?: string[];
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  children?: SlashMenuItem[];
  onItemClick: () => void;
}

export interface SlashMenuFeaturePolicy {
  transcodeVideoUploads: boolean;
  openAttachmentsExternally: boolean;
  localFolderNotebook?: boolean;
}

export function isSlashMenuDivider(item: SlashMenuItem): boolean {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as { type?: string }).type === "divider"
  );
}

export function getBlockNoteSlashMenuItems(
  editor: BlockNoteEditor<any, any, any>,
  aiEnabled: boolean,
  features: SlashMenuFeaturePolicy = {
    transcodeVideoUploads: true,
    openAttachmentsExternally: true,
  },
): SlashMenuItem[] {
  // 插入完成后：把光标移到新块、把视图滚动到新块、把焦点交回编辑器
  const focusAndScrollTo = (block: { id: string }) => {
    try {
      editor.setTextCursorPosition(block, "end");
    } catch {
      /* block 可能已被 BlockNote 内部刷新；忽略 */
    }
    editor.focus();
    // React 自定义块（如 codeBlock）的 contentDOM 挂载是异步的：上面同步设的
    // PM 光标位置在 DOM 里找不到落点，会被回退到块容器外——表现为创建代码块后
    // 立刻粘贴贴到块外。等本轮事件处理结束、React 挂载完成后补设一次，把 DOM
    // 光标真正送进块内。用 setTimeout 而非 rAF：后台标签页 rAF 不触发。
    window.setTimeout(() => {
      try {
        editor.setTextCursorPosition(block, "end");
      } catch {
        /* block 可能已被 BlockNote 内部刷新；忽略 */
      }
      editor.focus();
    }, 0);
    // 等 DOM 更新一帧后再滚动，确保新块已渲染
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-id="${block.id}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const insertOrUpdate = (block: any): any => {
    // 必须在点击执行时实时读取当前块：BlockNote 在调用 onItemClick 之前已先跑过
    // closeMenu() → clearQuery()（删掉触发字符 / 或 、）。若沿用菜单构建时捕获的旧
    // 快照，content 仍带着 /，会误判 hasTrigger 并对陈旧 block 引用做二次清空，
    // 导致转换落到相邻块、整篇下移一行（用户反馈：第一行按 / 第二行却变成了标题）。
    const currentBlock = editor.getTextCursorPosition().block;
    const content = currentBlock.content as any;

    // 剥掉行首触发字符（/ 或 、），返回剩余 inline 内容。
    // 不能用「先 updateBlock 清空 content 再取光标块」的两步法：清空一个带 children 的块
    // （如带 children 的列表项）的标题后，光标会跳进它的第一个子块，第二步
    // getTextCursorPosition() 取到的是子块而非原块，导致转换落到子块、原块标题与缩进
    // 子内容（含图片）全部错乱丢失。改为对 currentBlock（稳定引用）一次性 updateBlock。
    const stripLeadingTrigger = (
      c: any,
    ): { hasTrigger: boolean; content: any } => {
      if (!Array.isArray(c) || c.length === 0 || c[0]?.type !== "text") {
        return { hasTrigger: false, content: c };
      }
      const text = c[0].text || "";
      const trigger = text.startsWith("/")
        ? "/"
        : text.startsWith("、")
          ? "、"
          : null;
      if (!trigger) return { hasTrigger: false, content: c };
      const nextText = text.slice(trigger.length);
      return {
        hasTrigger: true,
        content: nextText
          ? [{ ...c[0], text: nextText }, ...c.slice(1)]
          : c.slice(1),
      };
    };

    const stripped = stripLeadingTrigger(content);
    const hasTrigger = stripped.hasTrigger;

    let target: any;
    if (hasTrigger) {
      // 目标块若是 inline 内容块（段落/标题/各类列表项），保留剥掉触发符后的 content；
      // 若是结构化块（image/divider 等，content: "none"），不能塞 content。
      const targetKind = (editor.schema as any).blockSchema?.[block.type]
        ?.content;
      target = editor.updateBlock(
        currentBlock,
        targetKind === "inline"
          ? { ...block, content: stripped.content }
          : block,
      );
    } else {
      const isEmpty =
        !content ||
        (Array.isArray(content) && content.length === 0) ||
        (typeof content === "string" && content.trim() === "");
      if (isEmpty) {
        editor.updateBlock(currentBlock, block);
        target = currentBlock;
      } else {
        const [inserted] = editor.insertBlocks([block], currentBlock, "after");
        target = inserted;
      }
    }
    if (target?.id) focusAndScrollTo(target);
    return target;
  };

  const items: SlashMenuItem[] = [];

  // 未启用 AI 的构建不添加「生成」斜杠项。
  if (aiEnabled && (__GOOSE_EDITOR_AI__ || false)) {
    items.push({
      title: "生成",
      description: "接着写点什么...",
      icon: SLASH_ICONS.sparkles,
      aliases: ["ai", "generate", "shengcheng", "xiezuo", "sparkle"],
      onItemClick: () => {
        // 删除触发字符 / 或 、
        const pos = editor.getTextCursorPosition();
        const block = pos.block;
        const content = block.content as any[];
        if (
          Array.isArray(content) &&
          content.length === 1 &&
          content[0]?.type === "text" &&
          (content[0].text === "/" || content[0].text === "、")
        ) {
          editor.updateBlock(block, { content: [] });
        } else if (
          Array.isArray(content) &&
          content.length >= 1 &&
          content[0]?.type === "text" &&
          (content[0].text.startsWith("/") || content[0].text.startsWith("、"))
        ) {
          const newText = content[0].text.slice(1);
          editor.updateBlock(block, {
            content: newText ? [{ ...content[0], text: newText }] : [],
          });
        }

        const ai = editor.getExtension(AIExtension);
        const blockId = editor.getTextCursorPosition().block.id;
        if (ai && blockId) {
          ai.openAIMenuAtBlock(blockId);
        }
      },
    });
  }

  items.push(
    {
      title: "一级标题",
      description: "大标题",
      icon: SLASH_ICONS.heading1,
      aliases: ["h1", "heading1", "title", "biaoti"],
      badge: "#",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 1 },
        }),
    },
    {
      title: "二级标题",
      description: "中标题",
      icon: SLASH_ICONS.heading2,
      aliases: ["h2", "heading2", "subtitle", "biaoti"],
      badge: "##",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 2 },
        }),
    },
    {
      title: "三级标题",
      description: "小标题",
      icon: SLASH_ICONS.heading3,
      aliases: ["h3", "heading3", "biaoti"],
      badge: "###",
      onItemClick: () =>
        insertOrUpdate({
          type: "heading",
          props: { level: 3 },
        }),
    },
    { type: "divider" } as any,
    {
      title: "待办事项",
      description: "带有复选框的任务列表",
      icon: SLASH_ICONS.check,
      aliases: [
        "todo",
        "task",
        "daiban",
        "renwu",
        "提醒",
        "提醒事项",
        "tixing",
      ],
      badge: "[]",
      onItemClick: () => insertOrUpdate({ type: "checkListItem" }),
    },
    {
      title: "无序列表",
      description: "创建普通的项目符号列表",
      icon: SLASH_ICONS.list,
      aliases: ["list", "bullet", "liebiao"],
      badge: "-",
      onItemClick: () => insertOrUpdate({ type: "bulletListItem" }),
    },
    {
      title: "有序列表",
      description: "创建带有数字的列表",
      icon: SLASH_ICONS.listOrdered,
      aliases: ["ordered", "list", "liebiao"],
      badge: "1.",
      onItemClick: () => insertOrUpdate({ type: "numberedListItem" }),
    },
    {
      title: "引用",
      description: "插入一段引用文字",
      icon: SLASH_ICONS.quote,
      aliases: ["quote", "blockquote", "yinyong"],
      badge: "| ",
      onItemClick: () => insertOrUpdate({ type: "quote" }),
    },
    {
      title: "标注",
      description: "插入带图标的重点标注块",
      icon: SLASH_ICONS.info,
      aliases: ["callout", "annotation", "info", "biaozhu", "tishi"],
      onItemClick: () => insertOrUpdate({ type: "callout" }),
    },
    {
      title: "分隔线",
      description: "插入一条水平分割线",
      icon: SLASH_ICONS.minus,
      aliases: ["divider", "separator", "hr", "fengexian"],
      badge: "---",
      onItemClick: () => insertOrUpdate({ type: "divider" }),
    },
    { type: "divider" } as any,
    {
      title: "表格",
      description: "插入一个简单的表格",
      icon: SLASH_ICONS.table,
      aliases: ["table", "biaoge"],
      onItemClick: () => {
        insertOrUpdate({
          type: "table",
          content: {
            type: "tableContent",
            rows: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }],
          },
        } as any);
      },
    },
    {
      title: "代码块",
      description: "插入带语法高亮的代码块",
      icon: SLASH_ICONS.code,
      aliases: ["code", "block", "daima"],
      badge: "```",
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "markdown" } }),
    },
    {
      title: "数学公式",
      description: "插入数学公式块 (KaTeX)",
      icon: SLASH_ICONS.sigma,
      aliases: ["math", "formula", "gongshi", "katex"],
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "math" } }),
    },
    {
      title: "Mermaid 图表",
      description: "插入流程图、时序图等 (Mermaid)",
      icon: SLASH_ICONS.mermaid,
      aliases: ["mermaid", "chart", "diagram", "tubiao"],
      onItemClick: () =>
        insertOrUpdate({ type: "codeBlock", props: { language: "mermaid" } }),
    },
    {
      title: "图片",
      description: "插入图片选择器模块",
      icon: SLASH_ICONS.image,
      aliases: ["image", "photo", "tupian", "img"],
      onItemClick: () => {
        const inserted = insertOrUpdate({ type: "image" });
        editor.getExtension(FilePanelExtension)?.showMenu(inserted.id);
      },
    },
    {
      title: "视频",
      description: features.transcodeVideoUploads
        ? "上传视频并自动压缩为可播放的 MP4"
        : "上传视频并保存为 Markdown 相对资源",
      icon: SLASH_ICONS.video,
      aliases: ["video", "movie", "shipin", "luping"],
      onItemClick: () => {
        const inserted = insertOrUpdate({ type: "video" });
        // 视频为 void 块，末尾补空行便于继续书写
        try {
          const last = editor.document.at(-1);
          if (last?.id === inserted?.id) {
            editor.insertBlocks(
              [{ type: "paragraph", content: "" }],
              inserted,
              "after",
            );
          }
        } catch {
          // ignore
        }
        editor.getExtension(FilePanelExtension)?.showMenu(inserted.id);
      },
    },
    {
      title: "文件",
      description:
        features.localFolderNotebook || !features.openAttachmentsExternally
          ? "上传附件并保存为 Markdown 相对资源"
          : "上传附件并直接调用系统默认应用打开",
      icon: SLASH_ICONS.file,
      aliases: ["file", "attachment", "pdf", "wenjian", "fujian"],
      onItemClick: () => {
        const inserted = insertOrUpdate({ type: "file" });
        editor.getExtension(FilePanelExtension)?.showMenu(inserted.id);
      },
    },
  );

  let menuItems = items;

  // 紧凑模式精简斜杠菜单，保留常用输入块。
  if (__GOOSE_EDITOR_COMPACT__) {
    const compactSlashTitles = new Set([
      "一级标题",
      "二级标题",
      "待办事项",
      "无序列表",
      "有序列表",
      "引用",
      "标注",
      "分隔线",
      "代码块",
      "图片",
    ]);
    menuItems = menuItems.filter(
      (it) => !isSlashMenuDivider(it) && compactSlashTitles.has(it.title),
    );
  }

  return menuItems;
}

export function filterSlashMenuItems(
  items: SlashMenuItem[],
  query: string,
): SlashMenuItem[] {
  const q = query.trim().toLowerCase();

  // No query: return all items (dividers included for grouping)
  if (!q.length) return items;

  // With query: only return matching non-divider items
  const matched = items.filter((item) => {
    if ((item as any).type === "divider") return false;
    const haystacks = [
      item.title,
      item.description ?? "",
      ...(item.aliases ?? []),
    ].map((v) => v.toLowerCase());
    return haystacks.some((v) => v.includes(q));
  });

  return matched;
}
