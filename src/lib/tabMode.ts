import { isElectronRuntime } from "@/lib/electron/runtime";
import { useSettings } from "@/stores/useSettings";

/**
 * UI / store 实际生效的单标签门控。
 * Electron 桌面端永不强制 SingleTabTitle；uTools 仍跟随 settings.singleTabMode。
 */
export function effectiveSingleTabMode(
  singleTabMode: boolean = useSettings.getState().singleTabMode,
  isElectron: boolean = isElectronRuntime(),
): boolean {
  return Boolean(singleTabMode) && !isElectron;
}

export function useEffectiveSingleTabMode(): boolean {
  const singleTabMode = useSettings((state) => state.singleTabMode);
  return effectiveSingleTabMode(singleTabMode);
}
