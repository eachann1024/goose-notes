import { mergeCSSClasses } from "@blocknote/core";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Plus } from "@/components/ui/icons";

export type GooseAiMenuTag = {
  key: string;
  label: string;
  onClick: () => void;
};

export type GoosePromptSuggestionMenuProps = {
  onManualPromptSubmit: (userPrompt: string) => void;
  promptText?: string;
  onPromptTextChange?: (userPrompt: string) => void;
  icon?: ReactNode;
  rightSection?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  /** 忙态时在输入槽里单行展示思考/生成文本，不撑开高度。 */
  busyTickerText?: string;
  /** 可换行 tag 行；为空则不渲染。 */
  tags?: GooseAiMenuTag[];
  /** tag 行末尾的 ➕（打开 AI 设置），仅 idle 传入。 */
  showPlus?: boolean;
  onOpenAiPanel?: () => void;
  /** 自动增高上限（px），超出后内部滚动。默认约 6 行。 */
  maxAutoHeightPx?: number;
};

/**
 * 与 editor-ai-menu.css 对齐：
 * --goose-ai-line 20 + --goose-ai-pad-y 8*2 = 36 首行总高
 * 多行上限 ≈ 6 行内容 + 上下 padding
 */
const DEFAULT_LINE_HEIGHT_PX = 20;
const DEFAULT_PAD_Y_PX = 8;
const DEFAULT_MIN_HEIGHT_PX = DEFAULT_PAD_Y_PX * 2 + DEFAULT_LINE_HEIGHT_PX; // 36
const DEFAULT_MAX_AUTO_HEIGHT_PX =
  DEFAULT_LINE_HEIGHT_PX * 6 + DEFAULT_PAD_Y_PX * 2; // 136

/**
 * 行内 AI 提示菜单：多行 textarea + 高度随内容增长 + 可换行 tag 行。
 * 键盘：Enter 提交自由提示；Shift+Enter 换行。tag 是原生 button，Enter 由浏览器处理。
 */
export function GoosePromptSuggestionMenu(
  props: GoosePromptSuggestionMenuProps,
) {
  const {
    onManualPromptSubmit,
    promptText,
    onPromptTextChange,
    disabled,
    maxAutoHeightPx = DEFAULT_MAX_AUTO_HEIGHT_PX,
  } = props;

  const [internalPromptText, setInternalPromptText] = useState("");
  const promptTextToUse = promptText ?? internalPromptText;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.currentTarget.value;
      if (onPromptTextChange) {
        onPromptTextChange(newValue);
      }
      if (promptText === undefined) {
        setInternalPromptText(newValue);
      }
    },
    [onPromptTextChange, promptText],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // 换行：Shift+Enter（或 IME 组合中不处理）
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        // 允许默认插入换行
        return;
      }

      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        const trimmed = promptTextToUse.trim();
        if (trimmed) {
          onManualPromptSubmit(promptTextToUse);
        }
        return;
      }
    },
    [onManualPromptSubmit, promptTextToUse],
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasBeenDisabled = useRef(disabled);

  useEffect(() => {
    if (textareaRef.current && hasBeenDisabled.current && !disabled) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    if (disabled) {
      hasBeenDisabled.current = true;
    }
  }, [disabled]);

  // 高度随内容增长（border-box 含 padding）；最小值 = 图标槽，保证首行中线对齐
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.boxSizing = "border-box";
    if (props.busy) {
      el.style.height = `${DEFAULT_MIN_HEIGHT_PX}px`;
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "0px";
    const measured = el.scrollHeight;
    const next = Math.min(
      Math.max(measured, DEFAULT_MIN_HEIGHT_PX),
      maxAutoHeightPx,
    );
    el.style.height = `${next}px`;
    el.style.overflowY = measured > maxAutoHeightPx ? "auto" : "hidden";
  }, [
    promptTextToUse,
    disabled,
    maxAutoHeightPx,
    props.placeholder,
    props.busy,
    props.busyTickerText,
  ]);

  const hasRightSection = props.rightSection != null;
  const tags = props.tags ?? [];
  const showTagRow = tags.length > 0 || (props.showPlus && props.onOpenAiPanel);

  return (
    <div className="bn-combobox goose-ai-prompt-menu">
      <div
        className={mergeCSSClasses(
          "goose-ai-prompt-field",
          hasRightSection ? "goose-ai-prompt-field--with-right" : "",
          disabled ? "goose-ai-prompt-field--disabled" : "",
          props.busy ? "goose-ai-prompt-field--busy" : "",
        )}
        aria-busy={props.busy ? true : undefined}
      >
        {props.icon != null && (
          <div className="goose-ai-prompt-field__icon" aria-hidden>
            {props.icon}
            <span className="goose-ai-sparkle-bit goose-ai-sparkle-bit--a" />
            <span className="goose-ai-sparkle-bit goose-ai-sparkle-bit--b" />
            <span className="goose-ai-sparkle-bit goose-ai-sparkle-bit--c" />
            <span className="goose-ai-sparkle-bit goose-ai-sparkle-bit--d" />
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="goose-ai-prompt-field__textarea bn-combobox-input"
          name="ai-prompt"
          rows={1}
          value={promptTextToUse || ""}
          placeholder={props.busy ? "" : props.placeholder}
          disabled={props.disabled}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          autoComplete="off"
          aria-multiline="true"
          aria-hidden={props.busy ? true : undefined}
          spellCheck={false}
        />
        {props.busy ? (
          <div
            className="goose-ai-think-ticker"
            role="status"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="goose-ai-think-ticker__scroller">
              {props.busyTickerText?.trim() || props.placeholder || "思考中"}
            </div>
          </div>
        ) : null}
        {hasRightSection && (
          <div className="goose-ai-prompt-field__right">
            {props.rightSection}
          </div>
        )}
      </div>
      {showTagRow && (
        <div className="goose-ai-tags" role="group" aria-label="AI 快捷操作">
          {tags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              className="goose-ai-tag"
              onMouseDown={(event) => {
                // 避免 mousedown 抢走 textarea 焦点导致浮层抖动
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                tag.onClick();
              }}
            >
              {tag.label}
            </button>
          ))}
          {props.showPlus && props.onOpenAiPanel && (
            <button
              type="button"
              className="goose-ai-tag goose-ai-tag--plus"
              aria-label="打开 AI 设置"
              title="打开 AI 设置"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onOpenAiPanel?.();
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
