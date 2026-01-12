import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import AutoJoiner from "tiptap-extension-auto-joiner";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { CodeBlockWithLanguageExtension } from "@/extensions/CodeBlockWithLanguage";
import { Markdown } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { all, createLowlight } from "lowlight";
import { configureSlashCommand } from "@/extensions/SlashCommand";
import { ResizableImage } from "@/extensions/ResizableImage";
import { CustomGlobalDragHandle } from "@/extensions/CustomGlobalDragHandle";
import { ImagePlaceholder } from "@/extensions/ImagePlaceholder";
import { SmartSelectAll } from "@/extensions/SmartSelectAll";
import { TitleHeading } from "@/extensions/TitleHeading";
import { HeadingWithBackspace } from "@/extensions/HeadingWithBackspace";
import { InlineCodeFix } from "@/extensions/InlineCodeFix";
import { LinkPasteHandler } from "@/extensions/LinkPasteHandler";
import { SelectableHorizontalRule } from "@/extensions/SelectableHorizontalRule";

const lowlight = createLowlight(all);

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    heading: false,
    horizontalRule: false,
    dropcursor: {
      color: "hsl(221.2, 83.2%, 53.3%)",
      width: 3,
    },
  }),
  SelectableHorizontalRule,
  HeadingWithBackspace.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  TitleHeading,
  AutoJoiner,
  Placeholder.configure({
    placeholder: ({ node, pos, editor }) => {
      const doc = editor.state.doc;
      const { $from } = editor.state.selection;
      if ($from.depth === 0) return "";
      const currentBlockPos = $from.before($from.depth);
      if (pos !== currentBlockPos) return "";

      const resolved = doc.resolve(pos);
      const isTopLevel = resolved.depth === 1;
      const isFirstTopLevel = isTopLevel && resolved.index(1) === 0;

      if (
        node.type.name === "heading" &&
        node.attrs?.level === 1 &&
        isFirstTopLevel
      ) {
        return "无标题";
      }

      if (node.type.name === "paragraph") {
        return "输入文本，按 空格 启用 AI，按 / 启用指令...";
      }

      return "";
    },
    showOnlyCurrent: false,
    includeChildren: true,
    showOnlyWhenEditable: true,
  }),
  Link.extend({ inclusive: false }).configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    validate: (href) => /^https?:\/\//.test(href),
  }),
  ResizableImage,
  ImagePlaceholder,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  CodeBlockWithLanguageExtension.configure({
    lowlight,
  }),
  Table.configure({
    resizable: true,
    renderWrapper: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  configureSlashCommand(),
  CustomGlobalDragHandle.configure({
    dragHandleWidth: 24,
    scrollTreshold: 100,
  }),
  Markdown.configure({
    html: true,
    tightLists: true,
    linkify: true,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: false,
  }),
  InlineCodeFix,
  LinkPasteHandler,
  SmartSelectAll,
];
