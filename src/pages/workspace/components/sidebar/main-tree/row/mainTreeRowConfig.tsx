import { type HTMLProps, type ReactNode } from "react";
import type {
  DraggingPosition,
  TreeInformation,
  TreeItem,
  TreeItemRenderContext,
} from "react-complex-tree";
import type { Page } from "@/types";
import {
  MAIN_TREE_INDENT,
  MAIN_TREE_ROW_PADDING_LEFT,
} from "../mainTreeDragGeometry";

export const INDENT = MAIN_TREE_INDENT;

export const ROW_PADDING_LEFT = MAIN_TREE_ROW_PADDING_LEFT;

export /** 子行标题相对行起点：行内补偿 4px + 图标槽 18px + sidebar-design 行距 10px。 */
const CHILD_TITLE_OFFSET = 4 + INDENT + 10;

export interface RenderItemArgs {
  item: TreeItem<Page>;
  depth: number;
  children: ReactNode | null;
  title: ReactNode;
  arrow: ReactNode;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
  onCreateLocalFile?: (parentId?: string) => void;
  onCreateLocalFolder?: (parentId?: string) => void;
  onCommitPendingCreate?: (id: string, name: string) => void;
  onCancelPendingCreate?: (id: string) => void;
  onItemDragStart?: (id: string) => void;
  onItemDragEnd?: () => void;
  onActivateLocalDirectory?: (
    id: string,
    mode: "preview" | "permanent",
  ) => void;
}

export interface RenderArrowArgs {
  item: TreeItem<Page>;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
}

export interface RenderItemsContainerArgs {
  children: ReactNode;
  containerProps: HTMLProps<HTMLUListElement>;
}

export interface RenderTreeContainerArgs {
  children: ReactNode;
  containerProps: HTMLProps<HTMLDivElement>;
}

export interface RenderDragBetweenLineArgs {
  draggingPosition: DraggingPosition;
  lineProps: HTMLProps<HTMLDivElement>;
}
