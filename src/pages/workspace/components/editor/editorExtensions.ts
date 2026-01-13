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
import { TableCellCustom } from "@/extensions/TableCellCustom";
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
import { EditorPasteHandler } from "@/extensions/EditorPasteHandler";
import { ClipboardSerializer } from "@/extensions/ClipboardSerializer";

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
    showOnlyCurrent: false,
    placeholder: ({ node, hasAnchor }) => {
      if (node.type.name === "heading" && node.attrs?.level === 1) {
        return "无标题";
      }

      if (!hasAnchor) return "";

      if (node.type.name === "paragraph") {
        return "输入 '/' 来输入指令...";
      }

      return "";
    },
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
  TableCellCustom,
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
  EditorPasteHandler,
  SmartSelectAll,
  ClipboardSerializer,
];
