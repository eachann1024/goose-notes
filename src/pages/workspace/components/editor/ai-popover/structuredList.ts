import type { Editor } from "@tiptap/core";

type StructuredListType = "bulletList" | "orderedList" | "taskList";

const STRUCTURED_LIST_KEYWORDS: Record<StructuredListType, string[]> = {
  bulletList: ["无序列表", "项目符号列表", "圆点列表", "bulletlist", "bullet"],
  orderedList: ["有序列表", "编号列表", "数字列表", "序号列表", "orderedlist", "numberedlist", "编号", "序号"],
  taskList: ["提醒事项", "提醒列表", "待办事项", "待办列表", "任务列表", "todo", "tasklist", "checklist", "复选框列表"],
};

function detectStructuredListTarget(query: string): StructuredListType | null {
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  let matchedType: StructuredListType | null = null;
  let matchedIndex = -1;

  (Object.entries(STRUCTURED_LIST_KEYWORDS) as Array<[StructuredListType, string[]]>).forEach(
    ([type, keywords]) => {
      keywords.forEach((keyword) => {
        const index = normalized.lastIndexOf(keyword);
        if (index < 0) return;
        if (index > matchedIndex) {
          matchedType = type;
          matchedIndex = index;
        }
      });
    },
  );

  return matchedType;
}

function getSelectionStructure(editor: Editor, from: number, to: number) {
  const listTypes = new Set<StructuredListType>();
  let textblockCount = 0;

  const collectListType = (nodeName: string) => {
    if (nodeName === "bulletList" || nodeName === "orderedList" || nodeName === "taskList") {
      listTypes.add(nodeName);
    }
  };

  const collectAncestorListTypes = ($pos: any) => {
    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      collectListType($pos.node(depth).type.name);
    }
  };

  collectAncestorListTypes(editor.state.doc.resolve(from));
  collectAncestorListTypes(editor.state.doc.resolve(to));

  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock) {
      textblockCount += 1;
    }
    collectListType(node.type.name);
  });

  return { listTypes, textblockCount };
}

export function resolveStructuredListIntent(editor: Editor, from: number, to: number, query: string) {
  if (from === to) return null;

  const targetListType = detectStructuredListTarget(query);
  if (!targetListType) return null;

  const { listTypes, textblockCount } = getSelectionStructure(editor, from, to);
  if (!listTypes.size && textblockCount < 2) {
    return null;
  }

  return { targetListType };
}

export function applyStructuredListIntent(
  editor: Editor,
  range: { from: number; to: number },
  targetListType: StructuredListType,
) {
  const didSelectRange = editor.chain().focus().setTextSelection(range).run();
  if (!didSelectRange) return "failed" as const;

  if (editor.isActive(targetListType)) {
    return "already-active" as const;
  }

  const didApply =
    targetListType === "bulletList"
      ? editor.chain().focus().toggleBulletList().run()
      : targetListType === "orderedList"
        ? editor.chain().focus().toggleOrderedList().run()
        : editor.chain().focus().toggleTaskList().run();

  return didApply ? ("applied" as const) : ("failed" as const);
}

