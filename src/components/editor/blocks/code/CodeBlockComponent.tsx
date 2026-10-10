import { useEditorSettings } from "@/components/editor/platform/hostContext";
import { useCodeBlockEdit } from "./useCodeBlockEdit";
import { useCodePreview } from "./useCodePreview";
import { CodeBlockView } from "./CodeBlockView";

export function CodeBlockComponent({
  block,
  contentRef,
  editor,
}: {
  block: any;
  contentRef: any;
  editor: any;
}) {
  const { onDefaultCodeBlockWrapChange, theme } = useEditorSettings();
  const language = (block.props.language as string) || "text";
  const wrap = block.props.wrap === true;
  const collapsed = block.props.collapsed === true;
  const summary =
    typeof block.props.summary === "string" ? block.props.summary : "";
  const isEditable = editor.isEditable;
  const edit = useCodeBlockEdit({
    block,
    contentRef,
    editor,
    isEditable,
    summary,
    collapsed,
    onDefaultCodeBlockWrapChange,
  });
  const preview = useCodePreview(edit.getCodeContent, language, wrap, theme);
  return (
    <CodeBlockView
      block={block}
      contentRef={contentRef}
      editor={editor}
      language={language}
      wrap={wrap}
      collapsed={collapsed}
      summary={summary}
      isEditable={isEditable}
      edit={edit}
      preview={preview}
    />
  );
}
