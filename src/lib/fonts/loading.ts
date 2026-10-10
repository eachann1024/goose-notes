import type { CustomFonts } from "@/stores/useSettings";
import {
  CANGER_JINKAI_LOCAL_NAMES,
  DEFAULT_FONT_NAMES,
  REMOTE_FONT_SOURCES,
  toCssFontFamily,
  splitFontList,
  trimFontName,
  type PersistentWoff2Family,
} from "./families";
const persistentFontLoads = new Map<string, Promise<boolean>>();

const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 4000) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Font loading timed out")),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
};

const hasLoadedFont = async (family: string) => {
  try {
    const faces = await withTimeout(
      document.fonts.load(`400 1em ${toCssFontFamily(family)}`, "中文"),
    );
    return faces.some((face) => face.status === "loaded");
  } catch {
    return false;
  }
};

const tryInstallLocalFont = async (family: PersistentWoff2Family) => {
  if (await hasLoadedFont(family)) return true;

  for (const localName of CANGER_JINKAI_LOCAL_NAMES) {
    try {
      const face = new FontFace(family, `local("${localName}")`, {
        style: "normal",
        weight: "400",
      });
      await withTimeout(face.load());
      document.fonts.add(face);
      return true;
    } catch {
      // 本机没有这个名字，试下一个。
    }
  }
  return hasLoadedFont(family);
};

const installRemoteFontFromUrls = async (family: PersistentWoff2Family) => {
  if (await tryInstallLocalFont(family)) return true;

  await waitForFonts([family]);
  if (await hasLoadedFont(family)) return true;

  for (const url of REMOTE_FONT_SOURCES[family]) {
    try {
      const face = new FontFace(family, `url("${url}")`, {
        style: "normal",
        weight: "400",
      });
      await withTimeout(face.load());
      document.fonts.add(face);
      return true;
    } catch (error) {
      console.warn(`[fontLoader] ${family} 从 ${url} 加载失败`, error);
    }
  }
  return false;
};

/** 用户选择衬线体时，本机字体优先；网络加载在后台且有超时。 */
export function ensurePersistentRemoteFont(family: PersistentWoff2Family) {
  if (
    typeof document === "undefined" ||
    typeof FontFace === "undefined" ||
    !("fonts" in document)
  ) {
    return Promise.resolve(false);
  }

  const existing = persistentFontLoads.get(family);
  if (existing) return existing;

  const load = installRemoteFontFromUrls(family).catch((error) => {
    console.warn(`[fontLoader] ${family} 远端加载失败`, error);
    persistentFontLoads.delete(family);
    return false;
  });
  persistentFontLoads.set(family, load);
  return load;
}

/** 切换字体时后台备字，不挡住 UI。本机自定义名也只后台匹配。 */
export async function ensureEditorFontAvailable(
  fontFamily: "default" | "serif" | "mono" | undefined,
  customFonts: CustomFonts,
) {
  const category = fontFamily ?? "default";
  const selectedFamilies = splitFontList(customFonts[category].font);
  const selectsJinKai = selectedFamilies.some((family) =>
    CANGER_JINKAI_LOCAL_NAMES.some(
      (localName) => localName.toLowerCase() === family.toLowerCase(),
    ),
  );
  const usesBuiltInSerif =
    category === "serif" &&
    (selectedFamilies.length === 0 ||
      selectedFamilies.includes(DEFAULT_FONT_NAMES.serif));

  if (selectsJinKai || usesBuiltInSerif) {
    void ensurePersistentRemoteFont(DEFAULT_FONT_NAMES.serif);
    return;
  }

  void waitForFonts(selectedFamilies);
}

export async function waitForFonts(families: string[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const uniqueFamilies = Array.from(new Set(families))
    .map(trimFontName)
    .filter(Boolean);
  if (!uniqueFamilies.length) return;

  await Promise.allSettled(
    uniqueFamilies.map((family) =>
      withTimeout(
        document.fonts.load(`400 1em ${toCssFontFamily(family)}`, "中文"),
      ),
    ),
  );
}
