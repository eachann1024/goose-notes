import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import AutoJoiner from "tiptap-extension-auto-joiner";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { CodeBlockWithLanguageExtension } from "@/extensions/CodeBlockWithLanguage";
import { Markdown } from "tiptap-markdown";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCellCustom } from "@/extensions/TableCellCustom";
import { TableCustom } from "@/extensions/TableCustom";
import { all, createLowlight } from "lowlight";
import { configureSlashCommand } from "@/extensions/SlashCommand";
import { ResizableImage } from "@/extensions/ResizableImage";
import { CustomGlobalDragHandle } from "@/extensions/CustomGlobalDragHandle";
import { DragHandleInteractionPatch } from "@/extensions/DragHandleInteractionPatch";
import { BlockUpdatedAt } from "@/extensions/BlockUpdatedAt";
import { ImagePlaceholder } from "@/extensions/ImagePlaceholder";
import { FileUploadPlaceholder } from "@/extensions/FileUploadPlaceholder";
import { FileAttachment } from "@/extensions/FileAttachment";
import { SmartSelectAll } from "@/extensions/SmartSelectAll";
import { TitleHeading } from "@/extensions/TitleHeading";
import { HeadingWithBackspace } from "@/extensions/HeadingWithBackspace";
import { HeadingCollapse } from "@/extensions/HeadingCollapse";
import { InlineCodeFix } from "@/extensions/InlineCodeFix";
import { InlineCodeInputRule } from "@/extensions/InlineCodeInputRule";
import { InlineMath } from "@/extensions/InlineMath";
import { Callout } from "@/extensions/Callout";
import { BlockColors } from "@/extensions/BlockColors";
import { LinkPasteHandler } from "@/extensions/LinkPasteHandler";
import { ProtectedImagePasteHandler } from "@/extensions/ProtectedImagePasteHandler";
import { SelectableHorizontalRule } from "@/extensions/SelectableHorizontalRule";
import { EditorPasteHandler } from "@/extensions/EditorPasteHandler";
import { ClipboardSerializer } from "@/extensions/ClipboardSerializer";
import Youtube from "@tiptap/extension-youtube";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";

import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Extension, InputRule } from "@tiptap/core";
import { useSettings } from "@/stores/useSettings";

const lowlight = createLowlight(all);

const UndoRedoKeymap = Extension.create({
  name: "undoRedoKeymap",
  addKeyboardShortcuts() {
    return {
      "Mod-z": () => this.editor.commands.undo(),
      "Shift-Mod-z": () => this.editor.commands.redo(),
      "Mod-y": () => this.editor.commands.redo(),
    };
  },
});

const PipeQuoteInputRule = Extension.create({
  name: "pipeQuoteInputRule",
  addInputRules() {
    return [
      new InputRule({
        find: /^(\||｜|》)\s$/,
        handler: ({ state, range, chain }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parentOffset > range.to - range.from) return null;
          chain().deleteRange(range).toggleBlockquote().run();
        },
      }),
    ];
  },
});

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    heading: false,
    horizontalRule: false,
    dropcursor: {
      color: false,
      class: "ProseMirror-dropcursor",
      width: 2,
    },
  }),
  UndoRedoKeymap,
  PipeQuoteInputRule,
  SelectableHorizontalRule,
  HeadingWithBackspace.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  HeadingCollapse,
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
        return useSettings.getState().ai.enabled
          ? "空格唤起 AI，/ 插入块..."
          : "输入 '/' 或 '、' 来输入指令...";
      }

      return "";
    },
  }),
  Link.extend({ inclusive: false }).configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    },
    validate: (href) => /^https?:\/\//.test(href),
  }),
  ResizableImage,
  ImagePlaceholder,
  FileUploadPlaceholder,
  FileAttachment,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  CodeBlockWithLanguageExtension.configure({
    lowlight,
  }),
  TableCustom.configure({
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
  DragHandleInteractionPatch,
  BlockUpdatedAt,
  Markdown.configure({
    html: true,
    tightLists: true,
    linkify: true,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
  InlineCodeFix,
  InlineCodeInputRule,
  InlineMath,
  Callout,
  // Underline, // Duplicate extension names found: ['underline']
  TextStyle,
  Color,
  BlockColors,
  Superscript,
  Subscript,
  Highlight.configure({
    multicolor: true,
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  Details.configure({
    HTMLAttributes: {
      class: "details-wrapper",
    },
  }),
  DetailsSummary,
  DetailsContent,
  Youtube.configure({
    controls: false,
    nocookie: true,
  }),
  Typography,
  ProtectedImagePasteHandler,
  LinkPasteHandler,
  EditorPasteHandler,
  SmartSelectAll,
  ClipboardSerializer,
];
