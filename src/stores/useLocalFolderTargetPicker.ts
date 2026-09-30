import { create } from "zustand";

export type LocalFolderTargetPickerMode = "move" | "import";

type PickerState = {
  open: boolean;
  mode: LocalFolderTargetPickerMode;
  workspaceId: string;
  pageId?: string;
  importFiles: File[];
  openMovePicker: (workspaceId: string, pageId: string) => void;
  openImportPicker: (workspaceId: string, files: File[]) => void;
  closePicker: () => void;
};

export const useLocalFolderTargetPicker = create<PickerState>((set) => ({
  open: false,
  mode: "move",
  workspaceId: "",
  pageId: undefined,
  importFiles: [],
  openMovePicker: (workspaceId, pageId) =>
    set({
      open: true,
      mode: "move",
      workspaceId,
      pageId,
      importFiles: [],
    }),
  openImportPicker: (workspaceId, files) =>
    set({
      open: true,
      mode: "import",
      workspaceId,
      pageId: undefined,
      importFiles: files,
    }),
  closePicker: () =>
    set({
      open: false,
      workspaceId: "",
      pageId: undefined,
      importFiles: [],
    }),
}));
