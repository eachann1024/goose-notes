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
import { InlineCodeFix } from "@/extensions/InlineCodeFix";
import Heading from "@tiptap/extension-heading";

const lowlight = createLowlight(all);

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    heading: false,
    dropcursor: {
      color: "hsl(221.2, 83.2%, 53.3%)",
      width: 3,
    },
  }),
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  TitleHeading,
  AutoJoiner,
  Placeholder.configure({
    placeholder: ({ node, pos }) => {
      if (pos === 0 && node.type.name === "heading") {
        return "无标题";
      }
      return "输入 / 以使用命令...";
    },
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
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
    linkify: false,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: false,
  }),
  InlineCodeFix,
  SmartSelectAll,
];
