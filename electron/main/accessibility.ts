import { shell, systemPreferences } from "electron";

const MAC_ACCESSIBILITY_SETTINGS =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

export function isMacAccessibilityTrusted(): boolean {
  if (process.platform !== "darwin") return true;
  try {
    return systemPreferences.isTrustedAccessibilityClient(false);
  } catch {
    return true;
  }
}

export function requestMacAccessibilityAccess(): boolean {
  if (process.platform !== "darwin") return true;
  let trusted = false;
  try {
    trusted = systemPreferences.isTrustedAccessibilityClient(true);
  } catch {
    trusted = false;
  }
  if (!trusted) {
    void shell.openExternal(MAC_ACCESSIBILITY_SETTINGS);
  }
  return trusted;
}

export function getAccessibilityStatus(): {
  platform: NodeJS.Platform;
  trusted: boolean;
} {
  return {
    platform: process.platform,
    trusted: isMacAccessibilityTrusted(),
  };
}
