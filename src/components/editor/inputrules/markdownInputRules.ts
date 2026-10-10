import { createExtension } from "@blocknote/core";
import { Plugin } from "@tiptap/pm/state";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";

type BlockTrigger = {
  type: string;
  props: Record<string, unknown>;
  triggerText: string;
  afterTransform?: () => void;
};

/**
 * 行首待办触发匹配：半角 `[]`/`[x]` 与中文 `【】`/`【x】`。
 * 转换使用同一规则。
 */
export function matchCheckListTrigger(
  textBefore: string,
): { checked: boolean; triggerText: string } | null {
  const matched = /^\s?(?:\[([ xX]?)\]|【([ xX]?)】)$/u.exec(textBefore);
  if (!matched) return null;
  const mark = matched[1] ?? matched[2] ?? "";
  return {
    checked: /x/i.test(mark),
    triggerText: matched[0],
  };
}

/**
 * 行首引用触发匹配：`>` / `＞` / `|` / `｜`。
 * 转换使用同一规则。
 */
export function matchQuoteTrigger(
  textBefore: string,
): { triggerText: string } | null {
  const matched = /^[>|｜＞]$/u.exec(textBefore);
  if (!matched) return null;
  return { triggerText: matched[0] };
}

/**
 * 将所有「行首标记 + 空格」的普通 markdown 块触发收敛到一处。
 *
 * BlockNote 原生及 createExtension.inputRules 最终都会使用同一个 undoable input-rule
 * 通道。该通道撤销块转换时会额外回填本次输入的空格，因此 `1. ` 退格会成为 `1.  `。
 * 这里自行处理转换，不注册输入规则撤销状态。空块的 Backspace 统一交给
 * emptyBlockBackspace 与 BlockNote 原生逻辑，直接退出块，不回填 Markdown 前缀；
 * 正常的撤销/重做仍由编辑历史处理。
 *
 * 此插件由共享 Editor 挂载，主窗与速记小窗完全一致。特殊块的 markdown 屏蔽仍由
 * suppressMarkdownInSpecialBlocks 负责，并因注册顺序优先于本插件执行。
 * 分隔线 `---` + 空格走 gooseDividerInputRuleExtension（divider 是 content:none，
 * 不能用本插件的 setNodeMarkup）；Enter 由 BlockNote 把 `\n` 喂给同一条 `/^---+\s$/`。
 */
function getBlockTrigger(
  textBefore: string,
  editor: any,
  currentBlock: any,
): BlockTrigger | null {
  const code = /^```(.*?)$/u.exec(textBefore);
  if (code) {
    return {
      type: "codeBlock",
      props: { language: code[1].trim() || "text" },
      triggerText: code[0],
    };
  }

  const ordered = /^\s?(\d+)([.。])$/u.exec(textBefore);
  if (ordered) {
    const start = Number.parseInt(ordered[1], 10);
    return {
      type: "numberedListItem",
      props: start === 1 ? {} : { start },
      triggerText: ordered[0],
    };
  }

  const bullet = /^\s?[-+*]$/u.exec(textBefore);
  if (bullet) {
    return { type: "bulletListItem", props: {}, triggerText: bullet[0] };
  }

  // 半角 `[]` / `[x]` 与中文全角 `【】` / `【x】` 均转待办，对齐 `1.` / `1。` 的中英输入习惯。
  const checked = matchCheckListTrigger(textBefore);
  if (checked) {
    return {
      type: "checkListItem",
      props: { checked: checked.checked },
      triggerText: checked.triggerText,
    };
  }

  const heading = /^(#{1,6})$/u.exec(textBefore);
  if (heading) {
    return {
      type: "heading",
      props: { level: heading[1].length },
      triggerText: heading[0],
    };
  }

  const quote = matchQuoteTrigger(textBefore);
  if (quote) {
    return { type: "quote", props: {}, triggerText: quote.triggerText };
  }

  return null;
}

function createMarkdownBlockTrigger(editor: any) {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== " " || from !== to) return false;

        const { state } = view;
        const $from = state.doc.resolve(from);
        const parent = $from.parent;
        if (parent.type.name !== "paragraph" && parent.type.name !== "heading") {
          return false;
        }

        const textBefore = parent.textBetween(
          0,
          $from.parentOffset,
          null,
          "￼",
        );
        const currentBlock = editor.getTextCursorPosition().block;
        const trigger = getBlockTrigger(textBefore, editor, currentBlock);
        if (!trigger) return false;

        // 所有 markdown 触发只允许从普通段落开始。
        if (parent.type.name !== "paragraph") {
          return false;
        }

        const blockPos = $from.before($from.depth);
        const targetType = state.schema.nodes[trigger.type];
        if (!targetType) return false;

        // 已有成对围栏时整体转换；只查同级块，不吞掉无闭合标记的后续正文。
        if (
          trigger.type === "codeBlock" &&
          $from.parentOffset === parent.content.size &&
          !currentBlock.children.length
        ) {
          const body: any[] = [];
          let next = editor.getNextBlock(currentBlock);
          while (next) {
            const isClosingFence =
              next.type === "paragraph" &&
              !next.children.length &&
              Array.isArray(next.content) &&
              next.content.every((item: any) => item.type === "text") &&
              /^```[ \t]*$/u.test(next.content.map((item: any) => item.text).join(""));
            if (isClosingFence) {
              // 先完成序列化再修改；复用导出逻辑保留待办、链接及嵌套列表标记。
              const content = jsonContentToMarkdown(body);
              editor.transact(() => {
                editor.updateBlock(currentBlock, {
                  type: "codeBlock",
                  props: trigger.props,
                  content,
                });
                editor.removeBlocks([...body, next]);
                editor.setTextCursorPosition(currentBlock.id, "start");
              });
              return true;
            }
            body.push(next);
            next = editor.getNextBlock(next);
          }
        }

        const tr = state.tr;
        tr.setNodeMarkup(blockPos, targetType, {
          ...parent.attrs,
          ...trigger.props,
        });
        tr.delete(from - trigger.triggerText.length, from);
        view.dispatch(tr);
        trigger.afterTransform?.();
        return true;
      },
    },
  });
}

export const gooseMarkdownInputRulesExtension = createExtension(({ editor }) => ({
  key: "goose-markdown-input-rules",
  prosemirrorPlugins: [createMarkdownBlockTrigger(editor)],
}));
