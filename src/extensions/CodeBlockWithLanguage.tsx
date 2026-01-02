import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { CodeBlockToolbar } from "@/pages/workspace/components/editor/CodeBlockToolbar";

function CodeBlockWithLanguageView({
  node,
  updateAttributes,
  editor,
  getPos,
}: any) {
  const isActive = useEditorState({
    editor,
    selector: (ctx) => {
      if (typeof getPos !== "function") {
        return ctx.editor.isActive("codeBlock");
      }
      const { from, to } = ctx.editor.state.selection;
      const pos = getPos();
      return from >= pos && to <= pos + node.nodeSize;
    },
  });
  const language = node.attrs.language || "";

  const getCodeContent = () => {
    let text = "";
    node.content?.forEach((child: any) => {
      if (child.text) text += child.text;
      child.content?.forEach((line: any) => {
        if (line.text) text += line.text;
      });
    });
    return text;
  };

  const handleLanguageChange = (newLanguage: string) => {
    updateAttributes({ language: newLanguage });
  };

  const handleFormat = (formatted: string) => {
    if (typeof getPos === "function") {
      const pos = getPos();
      const { tr } = editor.view.state;
      const start = pos + 1;
      const end = pos + node.nodeSize - 1;

      editor.view.dispatch(
        tr.replaceWith(start, end, editor.schema.text(formatted)),
      );
    }
  };

  const textContent = node.content?.firstChild?.text || node.textContent || "";
  const lineCount = textContent.split("\n").length;
  const showLineNumbers = true;

  return (
    <NodeViewWrapper
      className={`code-block-node relative group my-4 ${showLineNumbers ? "code-block-with-lines" : ""} ${isActive ? "is-active" : ""}`}
    >
      <CodeBlockToolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        getCodeContent={getCodeContent}
        onFormat={handleFormat}
        editable={editor.isEditable}
      />
      {showLineNumbers && (
        <div className="line-numbers" contentEditable={false}>
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <pre>
        <NodeViewContent className="hljs" style={{ whiteSpace: "pre" }} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockWithLanguageExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithLanguageView);
  },
});
