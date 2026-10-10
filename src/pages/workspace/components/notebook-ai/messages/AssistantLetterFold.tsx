import { useState, type ReactNode } from "react";
function LetterFoldChevron() {
  return (
    <svg
      className="notebook-ai-letter-chev"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** 有变更计划时，把说明收进折叠，默认收起，把版面让给整页改动。 */
export function AssistantLetterFold({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="notebook-ai-letter-fold">
      <button
        type="button"
        className="notebook-ai-letter-fold-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LetterFoldChevron />
        <span>思考</span>
      </button>
      {open ? (
        <div className="notebook-ai-letter-fold-body">{children}</div>
      ) : null}
    </div>
  );
}

/** 从 context 读 isStreaming，避免 stream 结束时换 Text 组件类型导致整段 remount */
