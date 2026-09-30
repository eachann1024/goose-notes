import { create } from "zustand";

type State = {
  forceCollapseLeft: boolean;
  forceCollapseRight: boolean;
  leftExpandOverride: boolean;
  rightExpandOverride: boolean;
  setForceCollapse: (left: boolean, right: boolean) => void;
  setLeftExpandOverride: (value: boolean) => void;
  setRightExpandOverride: (value: boolean) => void;
};

export const useWorkspaceViewport = create<State>((set, get) => ({
  forceCollapseLeft: false,
  forceCollapseRight: false,
  leftExpandOverride: false,
  rightExpandOverride: false,
  setForceCollapse: (left, right) => {
    const cur = get();
    if (cur.forceCollapseLeft === left && cur.forceCollapseRight === right) {
      return;
    }
    set({
      forceCollapseLeft: left,
      forceCollapseRight: right,
      leftExpandOverride: left ? cur.leftExpandOverride : false,
      rightExpandOverride: right ? cur.rightExpandOverride : false,
    });
  },
  setLeftExpandOverride: (value) => {
    if (get().leftExpandOverride === value) return;
    set({ leftExpandOverride: value });
  },
  setRightExpandOverride: (value) => {
    if (get().rightExpandOverride === value) return;
    set({ rightExpandOverride: value });
  },
}));
