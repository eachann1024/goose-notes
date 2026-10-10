import type {
  BlockTypeTransformTarget,
  BlockTypeTransformIntent,
} from "./types";

const CONVERT_PATTERN =
  /(?:改成|改为|变成|变为|转成|转为|转换成|转换为|处理成|处理为|调整成|调整为|设为|做成|整理成|整理为|convert\s+(?:it|this|these)?\s*to|turn\s+(?:it|this|these)?\s*into|change\s+(?:it|this|these)?\s*to|make\s+(?:it|this|these)?\s*(?:a\s+)?)/i;
const NEGATED_PATTERN = /(?:不要|别|无需|不需要|禁止|do\s+not|don't)/i;
const MIXED_REWRITE_PATTERN =
  /(?:润色|翻译|扩写|改写|重写|总结|精简|纠错|续写|polish|translate|rewrite|summari[sz]e)/i;
const WHOLE_PAGE_SCOPE_PATTERN =
  /(?:这里|这页|当前页(?:面)?|本页|本文|页面|正文|内容).{0,8}(?:所有|全部)|(?:所有|全部).{0,8}(?:内容|正文|段落|条目)|(?:整页|全页|全文|整篇|全篇|整个页(?:面)?|整个文档|whole\s+(?:page|document)|entire\s+(?:page|document)|all\s+(?:of\s+the\s+)?(?:content|text|paragraphs?))/i;

interface TargetDefinition {
  blockType: BlockTypeTransformTarget;
  pattern: RegExp;
  headingLevel?: 1 | 2 | 3;
}

const TARGET_DEFINITIONS: TargetDefinition[] = [
  {
    blockType: "checkListItem",
    pattern:
      /(?:待办(?:事项|清单|列表)?|任务(?:事项|清单|列表)?|可勾选(?:项|条目|列表)?|勾选项|todo(?:\s+list)?|check(?:\s|-)?list|checkbox(?:es)?)/i,
  },
  {
    blockType: "bulletListItem",
    pattern:
      /(?:无序(?:列表|清单|列表项)|项目符号(?:列表|清单|列表项)|bullet(?:ed)?\s+list)/i,
  },
  {
    blockType: "numberedListItem",
    pattern:
      /(?:有序(?:列表|清单|列表项)|编号(?:列表|清单|列表项)|(?:numbered|ordered)\s+list)/i,
  },
  {
    blockType: "heading",
    headingLevel: 1,
    pattern: /(?:一级标题|标题\s*1|h1\b|heading\s*1)/i,
  },
  {
    blockType: "heading",
    headingLevel: 2,
    pattern: /(?:二级标题|标题\s*2|h2\b|heading\s*2)/i,
  },
  {
    blockType: "heading",
    headingLevel: 3,
    pattern: /(?:三级标题|标题\s*3|h3\b|heading\s*3)/i,
  },
  {
    blockType: "paragraph",
    pattern: /(?:普通段落|正文段落|段落|paragraphs?)/i,
  },
  {
    blockType: "quote",
    pattern: /(?:引用块|引用段落|块引用|block\s*quote|quote\s+block)/i,
  },
  {
    blockType: "codeBlock",
    pattern: /(?:代码块|code\s+block)/i,
  },
];

function findTargetMatches(text: string) {
  const matches = TARGET_DEFINITIONS.flatMap((definition) => {
    const match = text.match(definition.pattern);
    if (!match || match.index === undefined) return [];
    return [
      {
        intent: {
          blockType: definition.blockType,
          ...(definition.headingLevel
            ? { headingLevel: definition.headingLevel }
            : {}),
        } satisfies BlockTypeTransformIntent,
        index: match.index,
        length: match[0].length,
      },
    ];
  });

  return matches.filter(
    (match, index) =>
      matches.findIndex(
        (candidate) =>
          candidate.intent.blockType === match.intent.blockType &&
          candidate.intent.headingLevel === match.intent.headingLevel,
      ) === index,
  );
}

function findTargetIntents(text: string): BlockTypeTransformIntent[] {
  return findTargetMatches(text).map((match) => match.intent);
}

/** 解析一段以目标类型开头的短语；供“生成某结构”场景做严格主结构判断。 */
export function resolveExplicitBlockTypeTarget(
  text: string,
): BlockTypeTransformIntent | null {
  const normalized = text.trimStart();
  const matches = findTargetMatches(normalized).filter(
    (match) => match.index === 0,
  );
  return matches.length === 1 ? matches[0].intent : null;
}

export function assertValidIntent(
  intent: BlockTypeTransformIntent,
): asserts intent is BlockTypeTransformIntent {
  if (!TARGET_DEFINITIONS.some((item) => item.blockType === intent.blockType)) {
    throw new Error("不支持该目标块类型。");
  }
  if (
    intent.blockType === "heading" &&
    ![1, 2, 3].includes(intent.headingLevel ?? 0)
  ) {
    throw new Error("标题转换必须明确指定一级、二级或三级标题。");
  }
  if (intent.blockType !== "heading" && intent.headingLevel !== undefined) {
    throw new Error("非标题块不能指定标题级别。");
  }
}

export function getBlockTypeTransformTargetLabel(
  intent: BlockTypeTransformIntent,
) {
  assertValidIntent(intent);
  switch (intent.blockType) {
    case "paragraph":
      return "普通段落";
    case "heading":
      return `${intent.headingLevel === 1 ? "一" : intent.headingLevel === 2 ? "二" : "三"}级标题`;
    case "bulletListItem":
      return "无序列表";
    case "numberedListItem":
      return "有序列表";
    case "checkListItem":
      return "待办事项";
    case "quote":
      return "引用块";
    case "codeBlock":
      return "代码块";
  }
}

export function resolveBlockTypeTransformIntent(
  prompt: string,
): BlockTypeTransformIntent | null {
  const normalized = prompt.trim();
  if (!normalized || NEGATED_PATTERN.test(normalized)) return null;
  if (MIXED_REWRITE_PATTERN.test(normalized)) return null;
  const convertMatch = normalized.match(CONVERT_PATTERN);
  if (!convertMatch || convertMatch.index === undefined) return null;

  const targetText = normalized.slice(
    convertMatch.index + convertMatch[0].length,
  );
  const targets = findTargetIntents(targetText);
  if (targets.length !== 1) return null;
  return targets[0];
}

/** 面板没有可信选区时，只允许用户明确要求转换整页正文。 */
export function hasWholePageBlockTypeTransformScope(prompt: string) {
  return WHOLE_PAGE_SCOPE_PATTERN.test(prompt.trim());
}
