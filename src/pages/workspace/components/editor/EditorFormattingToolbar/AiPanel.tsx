import { memo, useEffect, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { useAiPanelState } from "./useAiPanelState";
import { AiPanelInput } from "./AiPanelInput";
import { AiPanelResults } from "./AiPanelResults";

export interface AiPanelProps {
  editor: BlockNoteEditor<any, any, any>;
  savedSelection: { from: number; to: number } | null;
  selectedText: string;
  blockText: string;
  initialAction: "polish" | "rewrite" | "generate";
  onClose: () => void;
}

// memo：父组件 EditorFormattingToolbar 因 useEditorState/selectionchange
// 重渲染时，props 未变则跳过本组件渲染，React 不会 reconcile/更新
// textarea DOM，IME 合成过程不会被打断。
export const AiPanel = memo(function AiPanel({
  editor,
  savedSelection,
  selectedText,
  blockText,
  initialAction,
  onClose,
}: AiPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // ① pmViewDesc 防线：若 toolbar 渲染在 view.dom 内部，
    //    ProseMirror eventBelongsToView() 遍历到此节点时返回 false，
    //    跳过所有 composition/keyboard/input 处理，防止 IME 状态污染。
    (el as any).pmViewDesc = {
      stopEvent: () => true,
      ignoreMutation: () => true,
    };

    // ② bubble 阶段拦截：事件先正常到达 textarea（IME 可正常工作），
    //    冒泡回 wrapper 时调用 stopPropagation，阻止继续向上到 ProseMirror。
    //    注意：必须用 bubble（false），不能用 capture（true）——
    //    capture 会在事件到达 textarea 之前就截断，导致拼音无法显示。
    const stop = (e: Event) => e.stopPropagation();
    const EVENTS = [
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "keydown",
      "keyup",
      "keypress",
      "input",
      "beforeinput",
    ];
    EVENTS.forEach((name) => el.addEventListener(name, stop, false));

    return () => {
      delete (el as any).pmViewDesc;
      EVENTS.forEach((name) => el.removeEventListener(name, stop, false));
    };
  }, []);

  const aiPanelState = useAiPanelState({
    editor,
    savedSelection,
    selectedText,
    blockText,
    initialAction,
    onClose,
  });

  return (
    <div ref={wrapperRef} data-ai-inline-input className="flex w-full flex-col">
      <AiPanelInput
        phase={aiPanelState.phase}
        textareaRef={aiPanelState.textareaRef}
        initialAction={initialAction}
        onClose={onClose}
        handleSubmit={aiPanelState.handleSubmit}
        handleCancel={aiPanelState.handleCancel}
      />
      <AiPanelResults
        phase={aiPanelState.phase}
        streamPhase={aiPanelState.streamPhase}
        streamText={aiPanelState.streamText}
        reasoningText={aiPanelState.reasoningText}
        errorMessage={aiPanelState.errorMessage}
        outputScrollRef={aiPanelState.outputScrollRef}
        handleRetry={aiPanelState.handleRetry}
      />
    </div>
  );
});
