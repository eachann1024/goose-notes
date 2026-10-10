import { BrowserWindow } from "electron";
import { DEFAULT_TITLE_BAR_HEIGHT_PX } from "../../../src/lib/electron/titlebarLayout";
import { type QuicknoteLayout } from "../windowLayout";
import { WindowRegistry } from "../windowRegistry";
import { createQuicknoteActivateSuppression } from "../quicknoteActivateSuppression";

export const registry = new WindowRegistry<BrowserWindow>();

export const QUICKNOTE_IDLE_DESTROY_MS = 5 * 60 * 1000;

export const LAYOUT_PERSIST_DEBOUNCE_MS = 300;

export const visibilityListeners = new Set<() => void>();

export type WindowCreatedListener = (
  win: BrowserWindow,
  kind: "workspace" | "quicknote",
) => void;

export const windowCreatedListeners = new Set<WindowCreatedListener>();

/** 速记窗 show/close/steal focus 都会补发 activate，期间不要碰 workspace。 */
export const quicknoteActivateSuppression =
  createQuicknoteActivateSuppression();

/** 唤出速记时已 hide 的 workspace；macOS 随后 unhide 也必须再藏回去。 */
export const workspacesHeldHidden = new WeakSet<BrowserWindow>();

export const windowState = {
  lastTitleBarHeight: DEFAULT_TITLE_BAR_HEIGHT_PX,
  persistTimer: null as NodeJS.Timeout | null,
  rememberedQuicknote: undefined as QuicknoteLayout | null | undefined,
  quicknoteDestroyTimer: null as NodeJS.Timeout | null,
  lastEmittedVisible: false,
  quitting: false,
};
