export const REFINE_PLAN_EVENT = "goose-note:refine-ai-plan";
export type RefinePlanRequest = { notebookId: string; text: string };
export function requestPlanRefinement(request: RefinePlanRequest): void {
  window.dispatchEvent(
    new CustomEvent<RefinePlanRequest>(REFINE_PLAN_EVENT, { detail: request }),
  );
}
