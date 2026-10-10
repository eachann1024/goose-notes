import { createContext, useContext, useState, type ReactNode } from "react";

type ReviewSelection = {
  choices: Record<string, string[]>;
  setChoices: (key: string, ids: string[]) => void;
  locked: Record<string, boolean>;
  setLocked: (key: string, locked: boolean) => void;
};
const PlanReviewContext = createContext<ReviewSelection | null>(null);
export function PlanReviewProvider({ children }: { children: ReactNode }) {
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  return (
    <PlanReviewContext.Provider
      value={{
        choices,
        locked,
        setLocked: (key, value) =>
          setLocked((current) => ({ ...current, [key]: value })),
        setChoices: (key, ids) =>
          setChoices((current) => ({ ...current, [key]: ids })),
      }}
    >
      {children}
    </PlanReviewContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components -- 同一审批 Provider 的共享 hook。
export function usePlanReviewSelection(
  key: string,
  operationIds: string[],
  initialIds = operationIds,
) {
  const context = useContext(PlanReviewContext);
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const allowed = new Set(operationIds);
  const selectedIds = (context?.choices[key] ?? localIds ?? initialIds).filter(
    (id) => allowed.has(id),
  );
  const setSelectedIds = (ids: string[]) =>
    context ? context.setChoices(key, ids) : setLocalIds(ids);
  return {
    selectedIds,
    setSelectedIds,
    locked: context?.locked[key] ?? false,
    setLocked: (value: boolean) => context?.setLocked(key, value),
  };
}
