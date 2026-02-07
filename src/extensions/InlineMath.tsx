import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import React, { useState, useEffect } from "react";
import { MathView } from "@/pages/workspace/components/editor/extensions/MathView";
import { Input } from "@/components/ui/input";
import { InputRule, textblockTypeInputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

const InlineMathView = (props: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(props.node.attrs.value);

  useEffect(() => {
    setValue(props.node.attrs.value);
  }, [props.node.attrs.value]);

  const handleToggle = () => {
    if (props.editor.isEditable) {
      setIsEditing(!isEditing);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      props.updateAttributes({ value });
      setIsEditing(false);
    }
    if (e.key === "Escape") {
      setValue(props.node.attrs.value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    props.updateAttributes({ value });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="inline-math-node inline-block align-middle">
      {isEditing ? (
        <div className="relative inline-flex items-center">
          <span className="text-muted-foreground mr-1">$</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus
            className="h-6 px-1 py-0 min-w-[50px] inline-block font-mono text-sm border-none shadow-none focus-visible:ring-0"
            style={{ width: `${Math.max(value.length, 1)}ch` }}
          />
          <span className="text-muted-foreground ml-1">$</span>
        </div>
      ) : (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                onClick={handleToggle}
                className={`cursor-pointer rounded px-0.5 hover:bg-muted transition-colors ${!value ? "bg-destructive/10 text-destructive" : ""}`}
                aria-label={props.editor.isEditable ? "点击编辑公式" : undefined}
              >
                <MathView value={value || "公式"} />
              </span>
            </TooltipTrigger>
            {props.editor.isEditable ? (
              <TooltipContent side="top">点击编辑公式</TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      )}
    </NodeViewWrapper>
  );
};

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-value"),
        renderHTML: (attributes) => ({
          "data-value": attributes.value,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "inline-math" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$]+)\$$/,
        handler: ({ state, range, match, commands }) => {
          const { tr } = state;
          const matchLength = match[0].length;
          // range.from 是匹配开始的位置，range.to 是当前光标位置（输入 $ 后）
          const start = range.from;
          const end = range.to;

          // 确保起始位置有效
          if (start < 0 || end <= start) return null;

          // 删除匹配的文本并插入公式节点
          tr.delete(start, end);
          const node = this.type.create({ value: match[1] });
          tr.insert(start, node);

          // 将光标移到公式节点后面
          const newPos = start + node.nodeSize;
          tr.setSelection(TextSelection.create(tr.doc, newPos));

          state.apply(tr);
        },
      }),
    ];
  },
});
