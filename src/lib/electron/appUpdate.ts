import { getGooseDesktop } from "./runtime";
import { PUBLIC_RELEASES_LATEST_URL } from "@/lib/appUpdateRelease";

export type AppUpdateCheck = Awaited<
  ReturnType<NonNullable<GooseDesktop["checkForUpdate"]>>
>;

export async function readAppVersion(): Promise<string> {
  const desktop = getGooseDesktop();
  if (!desktop?.getAppVersion) return "";
  try {
    return await desktop.getAppVersion();
  } catch {
    return "";
  }
}

export async function checkAppUpdate(): Promise<AppUpdateCheck | null> {
  const desktop = getGooseDesktop();
  if (!desktop?.checkForUpdate) return null;
  return desktop.checkForUpdate();
}

export async function downloadAppUpdate(
  downloadUrl: string,
  filename: string,
): Promise<string | null> {
  const desktop = getGooseDesktop();
  if (!desktop?.downloadUpdate) return null;
  const result = await desktop.downloadUpdate(downloadUrl, filename);
  return result.path;
}

export function openReleasePage(url = PUBLIC_RELEASES_LATEST_URL): void {
  const desktop = getGooseDesktop();
  if (desktop) {
    void desktop.openUrl(url);
    return;
  }
  window.open(url, "_blank", "noreferrer");
}
