import { type UseLocalFolderWatchOptions } from "./local-folder-watch/shared";
import { useLocalFileChangeEvents } from "./local-folder-watch/useLocalFileChangeEvents";
import { useLocalFolderWatchLifecycle } from "./local-folder-watch/useLocalFolderWatchLifecycle";

export function useLocalFolderWatch(props: UseLocalFolderWatchOptions) {
  const events = useLocalFileChangeEvents(props);
  useLocalFolderWatchLifecycle(events);
}
