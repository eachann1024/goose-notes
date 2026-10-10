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
} from "@/components/ui/icons";
export const SLASH_ICONS = {
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
  slashIconWarmRoot.render(<div>{Object.values(SLASH_ICONS)}</div>);
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

/** 速记小窗 / 紧凑构建只保留常用输入块。 */
export const COMPACT_SLASH_MENU_TITLES = new Set([
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

export function filterCompactSlashMenuItems(
  items: SlashMenuItem[],
): SlashMenuItem[] {
  return items.filter(
    (it) => !isSlashMenuDivider(it) && COMPACT_SLASH_MENU_TITLES.has(it.title),
  );
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
