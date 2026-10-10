import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { heading, paragraph, table, callout, bulletList } from "./blocks";

function formatKey(part: string, isMac: boolean): string {
  const p = part.trim().toLowerCase();
  if (
    p === "mod" ||
    p === "cmdorctrl" ||
    p === "cmdorcontrol" ||
    p === "commandorcontrol" ||
    p === "command" ||
    p === "meta"
  ) {
    return isMac ? "⌘" : "Ctrl";
  }
  if (p === "ctrl" || p === "control") return isMac ? "⌃" : "Ctrl";
  if (p === "alt" || p === "option") return isMac ? "⌥" : "Alt";
  if (p === "shift") return isMac ? "⇧" : "Shift";
  if (p === "plus") return "+";
  if (p === "enter") return isMac ? "↵" : "Enter";
  if (p === "backspace") return isMac ? "⌫" : "Backspace";
  if (p === "tab") return isMac ? "⇥" : "Tab";
  if (p === "esc" || p === "escape") return isMac ? "⎋" : "Esc";
  if (p === "up") return "↑";
  if (p === "down") return "↓";
  if (p === "left") return "←";
  if (p === "right") return "→";
  return part.trim();
}

function formatSinglePlatform(shortcut: string, isMac: boolean): string {
  return shortcut
    .split("+")
    .map((part) => formatKey(part, isMac))
    .join(isMac ? "" : "+");
}

export function formatDualShortcut(shortcut: string): string {
  const win = formatSinglePlatform(shortcut, false);
  const mac = formatSinglePlatform(shortcut, true);
  if (win === mac) return win;
  return `${win}（${mac}）`;
}

export function formatDualShortcutGroup(...shortcuts: string[]): string {
  const wins = shortcuts.map((s) => formatSinglePlatform(s, false)).join(" / ");
  const macs = shortcuts.map((s) => formatSinglePlatform(s, true)).join(" / ");
  if (wins === macs) return wins;
  return `${wins}（${macs}）`;
}

const fixedShortcuts = getFixedAppShortcuts();
export const shortcutLabel = (shortcut: string) => formatDualShortcut(shortcut);
export const shortcutLabels = (...shortcuts: string[]) =>
  formatDualShortcutGroup(...shortcuts);

type ShortcutItem = {
  shortcut: string;
  action: string;
  note?: string;
};

type ShortcutSection = {
  title: string;
  description: string;
  items: ShortcutItem[];
};

const shortcutSections: ShortcutSection[] = [
  {
    title: "全局与工作区",
    description: "常用的全局操作快捷键。",
    items: [
      {
        shortcut: shortcutLabel("Mod+N"),
        action: "新建笔记",
        note: "在当前笔记本中新建并自动打开。",
      },
      {
        shortcut: shortcutLabel(fixedShortcuts.openSettings),
        action: "打开设置",
        note: "调整快捷键、搜索行为和外观。",
      },
      {
        shortcut: shortcutLabels("Mod+Plus", "Mod+-", "Mod+0"),
        action: "放大、缩小、重置编辑器字号",
        note: "影响阅读与编辑时的文本大小。",
      },
    ],
  },
  {
    title: "搜索与查找",
    description: "分别用于全局快速检索与当前笔记内文本查找。",
    items: [
      {
        shortcut: shortcutLabel("Mod+K"),
        action: "打开全局搜索",
        note: "搜索笔记标题与正文内容。",
      },
      {
        shortcut: "Tab",
        action: "切换搜索范围",
        note: "在当前笔记本与所有笔记本之间切换。",
      },
      {
        shortcut: shortcutLabel("Escape"),
        action: "关闭搜索面板",
        note: "固定按 Escape 关闭，不会同时关闭笔记。",
      },
      {
        shortcut: shortcutLabel("Mod+F"),
        action: "打开当前页查找",
        note: "只在当前页面内查找文本。",
      },
      {
        shortcut: shortcutLabels("Enter", "Shift+Enter"),
        action: "跳到下一个 / 上一个匹配",
        note: "查找框聚焦时可直接使用。",
      },
      {
        shortcut: shortcutLabels("Mod+G", "Mod+Shift+G"),
        action: "跳到下一个 / 上一个匹配",
        note: "不离开键盘继续浏览结果。",
      },
      {
        shortcut: shortcutLabels("F3", "Shift+F3"),
        action: "跳到下一个 / 上一个匹配",
        note: "另一组常见查找导航键。",
      },
      {
        shortcut: shortcutLabel("Esc"),
        action: "关闭当前页查找",
        note: "关闭后会回到编辑器。",
      },
    ],
  },
  {
    title: "极简工作区",
    description: "默认只保留当前笔记，用搜索或侧边栏直接切换。",
    items: [
      {
        shortcut: shortcutLabel("Mod+N"),
        action: "新建笔记",
        note: "创建后直接输入顶栏标题，按回车进入正文。",
      },
      {
        shortcut: shortcutLabel("Mod+K"),
        action: "搜索并切换笔记",
        note: "打开结果会替换当前笔记，不会新增标签。",
      },
    ],
  },
  {
    title: "编辑器格式化",
    description: "这组主要来自选中文本后的浮动工具栏。",
    items: [
      {
        shortcut: shortcutLabel("Mod+B"),
        action: "粗体",
      },
      {
        shortcut: shortcutLabel("Mod+I"),
        action: "斜体",
      },
      {
        shortcut: shortcutLabel("Mod+U"),
        action: "下划线",
      },
      {
        shortcut: shortcutLabel("Mod+Shift+S"),
        action: "删除线",
      },
      {
        shortcut: shortcutLabel("Mod+E"),
        action: "行内代码",
      },
      {
        shortcut: shortcutLabels(
          "Mod+Shift+L",
          "Mod+Shift+E",
          "Mod+Shift+R",
          "Mod+Shift+J",
        ),
        action: "左对齐 / 居中 / 右对齐 / 两端对齐",
      },
      {
        shortcut: shortcutLabel("Mod+Z"),
        action: "撤销",
      },
      {
        shortcut:
          shortcutLabel("Mod+Shift+Z") + " 或 " + shortcutLabel("Mod+Y"),
        action: "重做",
      },
      {
        shortcut: shortcutLabels("Tab", "Shift+Tab"),
        action: "表格中切换到下一个 / 上一个单元格",
        note: "只在表格内生效。",
      },
    ],
  },
  {
    title: "输入指令与块触发",
    description: "这组不是传统快捷键，更像快速输入语法。",
    items: [
      {
        shortcut: "/ 或 、",
        action: "打开斜杠菜单",
        note: "在空白段落里输入即可唤起。",
      },
      {
        shortcut: "# / ## / ###",
        action: "一级 / 二级 / 三级标题",
      },
      {
        shortcut: "[]",
        action: "待办列表",
      },
      {
        shortcut: "- / 1.",
        action: "无序列表 / 有序列表",
      },
      {
        shortcut: "|",
        action: "引用",
      },
      {
        shortcut: "``` / ---",
        action: "代码块 / 分隔线",
        note: "数学公式、Mermaid、表格和标注从斜杠菜单插入。",
      },
    ],
  },
];

function buildShortcutSection(section: ShortcutSection): PartialBlock[] {
  return [
    heading(2, section.title),
    paragraph(section.description),
    table(
      ["快捷方式", "作用", "备注"],
      section.items.map((item) => [
        item.shortcut,
        item.action,
        item.note ?? " ",
      ]),
    ),
  ];
}

export const onboardingSecondChildContent: BlockNoteContent = [
  heading(1, "快捷键指南"),
  paragraph("把快捷键分组记，比从头背到尾更轻松。先记你每天会按到的 5 个。"),
  callout(
    "⌨️",
    "如果某组你几乎不用，就先别背。会搜索、会查找、会撤销，效率已经能上来一大截。",
  ),
  ...shortcutSections.flatMap((section) => [
    ...buildShortcutSection(section),
    paragraph(),
  ]),
  heading(2, "关于保存这件事"),
  ...bulletList([
    `普通页面默认自动保存，所以这里不把 ${shortcutLabel("Mod+S")} 当成必学快捷键。`,
    `编辑本地文件时，按 ${shortcutLabel("Mod+S")} 会立即保存到磁盘。`,
    "真正值得优先记住的，是搜索、查找、标签切换和格式化这几组高频操作。",
  ]),
];
