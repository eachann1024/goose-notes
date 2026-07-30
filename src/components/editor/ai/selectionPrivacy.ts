import {
  aiDocumentFormats,
  type DocumentStateBuilder,
  type StreamToolsProvider,
} from "@blocknote/xl-ai";

const defaultDocumentStateBuilder =
  aiDocumentFormats.html.defaultDocumentStateBuilder;
const defaultStreamToolsProvider =
  aiDocumentFormats.html.getStreamToolsProvider({});
const selectionUpdateToolsProvider =
  aiDocumentFormats.html.getStreamToolsProvider({
    defaultStreamTools: { add: false, update: true, delete: false },
  });
type SelectionUpdateTool = ReturnType<
  typeof selectionUpdateToolsProvider.getStreamTools
>[number];

/**
 * 选区 AI 只发送裁剪后的 selectedBlocks，不再附带整篇笔记作为上下文。
 * 无选区入口保持 xl-ai 默认 documentState，仍可理解和编辑整篇文档。
 */
export function createPrivateSelectionDocumentStateBuilder(
  baseBuilder: DocumentStateBuilder<any>,
): DocumentStateBuilder<any> {
  return async (request) => {
    // xl-ai 默认用 getSelectionCutBlocks(true)，会把端点扩到完整单词。
    // 隐私模式重新按原始 PM range 裁剪，避免多发送用户没有选中的相邻字符。
    const exactRequest = request.selectedBlocks
      ? {
          ...request,
          selectedBlocks: request.editor.getSelectionCutBlocks(false).blocks,
        }
      : request;
    const documentState = await baseBuilder(exactRequest);
    if (!documentState.selection) return documentState;

    return {
      ...documentState,
      blocks: [],
    };
  };
}

export const goosePrivateSelectionDocumentStateBuilder =
  createPrivateSelectionDocumentStateBuilder(defaultDocumentStateBuilder);

function collectBlockIds(
  blocks: Array<{ id: string; children?: unknown[] }>,
  ids = new Set<string>(),
) {
  for (const block of blocks) {
    ids.add(block.id);
    if (Array.isArray(block.children)) {
      collectBlockIds(
        block.children as Array<{ id: string; children?: unknown[] }>,
        ids,
      );
    }
  }
  return ids;
}

function guardUpdateTool(
  tool: SelectionUpdateTool,
  selectedBlockIds: ReadonlySet<string>,
): SelectionUpdateTool {
  return {
    ...tool,
    validate(operation) {
      const result = tool.validate(operation);
      if (!result.ok) return result;

      const id = (result.value as { id?: string }).id;
      if (!id || !selectedBlockIds.has(id)) {
        return {
          ok: false,
          error: "AI 只能修改当前文字选区内的块。",
        };
      }
      return result;
    },
  };
}

/**
 * 选区模式只暴露 update，并同时用选区位置与块 ID 双重限制写入范围：
 * - xl-ai 的 updateSelection 会把端点块更新裁剪到精确字符范围；
 * - ID guard 阻止模型用未选块 ID 绕过范围限制；
 * - add/delete 不暴露，避免在选区外插入或删除整块。
 */
export const gooseSelectionScopedStreamToolsProvider: StreamToolsProvider<
  any,
  any
> = {
  getStreamTools(editor, selectionInfo, onBlockUpdate) {
    if (!selectionInfo) {
      return defaultStreamToolsProvider.getStreamTools(
        editor,
        selectionInfo,
        onBlockUpdate,
      ) as any;
    }

    const exactSelection = editor.getSelectionCutBlocks(false);
    const selectedBlockIds = collectBlockIds(exactSelection.blocks);
    const tools = selectionUpdateToolsProvider.getStreamTools(
      editor,
      {
        from: exactSelection._meta.startPos,
        to: exactSelection._meta.endPos,
      },
      onBlockUpdate,
    );

    return tools.map((tool) => guardUpdateTool(tool, selectedBlockIds)) as any;
  },
};
