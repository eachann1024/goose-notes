import type { AISlice } from "./slices/aiSlice";
import type { AppearanceSlice } from "./slices/appearanceSlice";
import type { ShortcutsSlice } from "./slices/shortcutsSlice";
import type { SearchProvidersSlice } from "./slices/searchProvidersSlice";
import type { LocalFolderSlice } from "./slices/localFolderSlice";
import type { WebdavSlice } from "./slices/webdavSlice";

export type SettingsState = AISlice &
  AppearanceSlice &
  ShortcutsSlice &
  SearchProvidersSlice &
  LocalFolderSlice &
  WebdavSlice & {
    _hasHydrated: boolean;
    defaultPageLayout: import("@/types").PageLayout;
    contentsWidth: number;
    setupGuideSeen: boolean;
    setupGuideOpen: boolean;
  };
