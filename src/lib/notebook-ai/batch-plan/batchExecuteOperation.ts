import type { BatchPlanOperationInput } from "./types";
import {
  type BatchOperationExecution,
  type BatchOperationExecutionState,
} from "./batchShared";
import { executeCreateOperation } from "./batchExecuteCreate";
import {
  executeEditOperation,
  executeSearchReplaceOperation,
} from "./batchExecuteEdit";
import { executeDeleteOperation } from "./batchExecuteDelete";

export async function executeOperation(
  operation: BatchPlanOperationInput,
  state: BatchOperationExecutionState,
): Promise<BatchOperationExecution> {
  switch (operation.type) {
    case "create":
      return executeCreateOperation(operation, state);
    case "edit":
      return executeEditOperation(operation, state);
    case "search_replace":
      return executeSearchReplaceOperation(operation, state);
    case "delete":
      return executeDeleteOperation(operation, state);
    default: {
      const unsupported: never = operation;
      throw new Error(
        `暂不支持的操作类型: ${(unsupported as { type?: string }).type ?? "unknown"}`,
      );
    }
  }
}
