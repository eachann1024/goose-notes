/** 对外保持统一入口；类型、搜索、序列化和上下文各自维护。 */
export * from "./referenceTypes";
export {
  inferAiReferenceRole,
  normalizeAiComposerPayload,
} from "./referenceRoles";
export { buildAiFileReferenceAttrs } from "./referenceMetadata";
export { getAiReferenceSuggestionItems } from "./referenceSuggestions";
export { serializeAiComposerDoc } from "./referenceSerialization";
export {
  buildFolderReferenceContext,
  resolveAiReferenceContexts,
  formatAiReferenceContextBlock,
  getAiReferenceStats,
} from "./referenceContext";
