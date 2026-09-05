export interface WebdavSliceState {
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavRemoteDir: string
  webdavRetentionDays: number
  webdavAutoBackupEnabled: boolean
  webdavLastUploadAt: string | null
  webdavLastUploadFilename: string | null
  webdavLastDownloadAt: string | null
  webdavLastDownloadFilename: string | null
}

export interface WebdavSliceActions {
  updateWebdavSettings: (settings: Partial<WebdavSliceState>) => void
  clearWebdavPassword: () => void
}

export type WebdavSlice = WebdavSliceState & WebdavSliceActions

export const DEFAULT_WEBDAV_REMOTE_DIR = "goose-note-app"

export const WEBDAV_INITIAL_STATE: WebdavSliceState = {
  webdavUrl: "https://example.com/dav/",
  webdavUsername: "",
  webdavPassword: "",
  // 新配置写入新目录；已保存的 "goose-notes" 值保持不变，以继续读取历史备份。
  webdavRemoteDir: DEFAULT_WEBDAV_REMOTE_DIR,
  webdavRetentionDays: 365,
  webdavAutoBackupEnabled: true,
  webdavLastUploadAt: null,
  webdavLastUploadFilename: null,
  webdavLastDownloadAt: null,
  webdavLastDownloadFilename: null,
}

type SetFn = (updater: Partial<WebdavSlice> | ((state: WebdavSlice) => Partial<WebdavSlice>)) => void

export function createWebdavSlice(set: SetFn): WebdavSlice {
  return {
    ...WEBDAV_INITIAL_STATE,
    updateWebdavSettings: (settings) => set((state) => ({ ...state, ...settings })),
    clearWebdavPassword: () => set({ webdavPassword: "" }),
  }
}
