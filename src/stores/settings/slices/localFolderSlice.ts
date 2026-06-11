export interface LocalFolderSliceState {
    localFolderExternalEditor: string
}

export interface LocalFolderSliceActions {
    setLocalFolderExternalEditor: (editor: string) => void
}

export type LocalFolderSlice = LocalFolderSliceState & LocalFolderSliceActions

export const LOCAL_FOLDER_INITIAL_STATE: LocalFolderSliceState = {
    localFolderExternalEditor: '',
}

type SetFn = (updater: Partial<LocalFolderSlice> | ((state: LocalFolderSlice) => Partial<LocalFolderSlice>)) => void

export function createLocalFolderSlice(set: SetFn): LocalFolderSlice {
    return {
        ...LOCAL_FOLDER_INITIAL_STATE,
        setLocalFolderExternalEditor: (editor) => set({ localFolderExternalEditor: editor }),
    }
}
