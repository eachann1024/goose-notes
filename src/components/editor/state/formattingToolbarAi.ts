import { create } from "zustand";

interface FormattingToolbarAiState {
  active: boolean;
  owner: object | null;
  selection: { from: number; to: number } | null;
  activate: (selection: { from: number; to: number }, owner?: object) => void;
  reset: (owner?: object) => void;
}

export const useFormattingToolbarAi = create<FormattingToolbarAiState>((set) => ({
  active: false,
  owner: null,
  selection: null,
  activate: (selection, owner) => set({ active: true, selection, owner: owner ?? null }),
  reset: (owner) => set((state) => owner && state.owner !== owner ? state : { active: false, selection: null, owner: null }),
}));
