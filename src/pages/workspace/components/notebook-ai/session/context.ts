import { createContext, useContext } from "react";
import type { NotebookAiSessionValue } from "./types";
export const NotebookAiSessionContext =
  createContext<NotebookAiSessionValue | null>(null);

export function useNotebookAiSession(): NotebookAiSessionValue {
  const value = useContext(NotebookAiSessionContext);
  if (!value) {
    throw new Error(
      "useNotebookAiSession 必须在 NotebookAiSessionProvider 内使用",
    );
  }
  return value;
}
