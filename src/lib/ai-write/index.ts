export type {
  AiWriteAction,
  AiBlockRange,
  AiTargetMode,
  AiTargetSource,
  AiTargetSelection,
  AiTargetRef,
  AiStickyTarget,
  AiResolvedTarget,
  AiWritePlan,
  AiContextBundle,
} from "./targetResolution";

export {
  resolveAiTargetReference,
  createAiChatOnlyTarget,
  resolvedTargetToSelection,
  stickyTargetToSelection,
  createStickyTargetFromResolvedTarget,
  resolveAiTargetSelection,
  resolveAiTargetIntent,
  resolveAiTargetFromSelection,
} from "./targetResolution";

export {
  buildAiContextBundle,
  buildAiWorkspaceUserPrompt,
} from "./contextBundle";

export { buildAiWritePlan } from "./planBuilder";

export { commitAiWritePlan } from "./planCommit";
