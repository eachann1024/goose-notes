import type { ClipperMode, ClipperSettings } from '../types'
import { DEFAULT_CLIPPER_SETTINGS } from '../types'

export interface ClipperSliceState {
    clipper: ClipperSettings
}

export interface ClipperSliceActions {
    setClipperInbox: (
        notebookId: string | null,
        pageId: string | null,
    ) => void
    setClipperMode: (mode: ClipperMode) => void
    setClipperInsertSourceMeta: (insert: boolean) => void
}

export type ClipperSlice = ClipperSliceState & ClipperSliceActions

export const CLIPPER_INITIAL_STATE: ClipperSliceState = {
    clipper: { ...DEFAULT_CLIPPER_SETTINGS },
}

type SetFn = (
    updater:
        | Partial<ClipperSlice>
        | ((state: ClipperSlice) => Partial<ClipperSlice>),
) => void

export function createClipperSlice(set: SetFn): ClipperSlice {
    return {
        ...CLIPPER_INITIAL_STATE,
        setClipperInbox: (notebookId, pageId) =>
            set((state) => ({
                clipper: {
                    ...state.clipper,
                    inboxNotebookId: notebookId,
                    inboxPageId: pageId,
                },
            })),
        setClipperMode: (mode) =>
            set((state) => ({
                clipper: { ...state.clipper, mode },
            })),
        setClipperInsertSourceMeta: (insert) =>
            set((state) => ({
                clipper: { ...state.clipper, insertSourceMeta: insert },
            })),
    }
}
