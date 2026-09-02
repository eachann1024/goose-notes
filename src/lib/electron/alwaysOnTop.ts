/**
 * Electron 主窗口「始终置顶」。非桌面构建调用直接返回 false / 忽略。
 */
import { getGooseDesktop } from "./runtime";

export async function getDesktopAlwaysOnTop(): Promise<boolean> {
  if (__HOST_TARGET__ !== "electron") return false;
  try {
    return Boolean(await getGooseDesktop()?.getAlwaysOnTop());
  } catch (error) {
    console.warn("[electron] 读取窗口置顶失败", error);
    return false;
  }
}

export async function setDesktopAlwaysOnTop(on: boolean): Promise<boolean> {
  if (__HOST_TARGET__ !== "electron") return false;
  try {
    return Boolean(await getGooseDesktop()?.setAlwaysOnTop(on));
  } catch (error) {
    console.warn("[electron] 设置窗口置顶失败", error);
    return false;
  }
}
