import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

function CodeBlockWithLanguageView({ node }: any) {
  // Calculate line numbers
  const textContent = node.content?.firstChild?.text || node.textContent || "";
  const lineCount = textContent.split("\n").length;
  const showLineNumbers = true; // Could be from settings later

  return (
    <NodeViewWrapper
      className={`relative group my-4 ${showLineNumbers ? "code-block-with-lines" : ""}`}
    >
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
