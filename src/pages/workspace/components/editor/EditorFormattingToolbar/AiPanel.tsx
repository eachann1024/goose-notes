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

export function AiPanel({
  editor,
  savedSelection,
  selectedText,
  blockText,
  initialAction,
  onClose,
}: AiPanelProps) {
  const aiPanelState = useAiPanelState({
    editor,
    savedSelection,
    selectedText,
    blockText,
    initialAction,
    onClose,
  });

  return (
    <div data-ai-inline-input className="flex w-full flex-col">
      <AiPanelInput
        phase={aiPanelState.phase}
        query={aiPanelState.query}
        setQuery={aiPanelState.setQuery}
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
}
