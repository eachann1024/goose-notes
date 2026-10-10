export interface LocalFolderLoadTask {
  fingerprint: string;
  requestId: number;
  promise: Promise<void>;
}

export const localFolderLoadTasks = new Map<string, LocalFolderLoadTask>();

export const latestLocalFolderLoadRequest = new Map<string, number>();
