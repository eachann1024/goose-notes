import { expect, test } from "playwright/test";
import {
  fileUrlToLocalPath,
  isEmbeddablePdfFontUrl,
  loadFirstPdfFontDataUrl,
  loadPdfFontDataUrl,
  registerPdfFonts,
  resolvePdfFontPlan,
  resolvePdfFontUrl,
  resetPdfFontLoadCache,
  toPdfFontDataUrl,
  PDF_CJK_FONT_URLS,
  PDF_DM_MONO_TTF_URLS,
  PDF_FONT_FAMILY,
  PDF_FONT_RELATIVE_PATHS,
} from "../../src/lib/pdfExport/fontConfig";

test("file:// 插件页把相对 fonts/ 解析到同目录，而不是磁盘根 /fonts/", () => {
  const href = "file:///Users/eachann/Library/Application%20Support/uTools/plugins/goose-note/index.html";
  const url = resolvePdfFontUrl(PDF_FONT_RELATIVE_PATHS[0], href);
  expect(url).toBe(
    "file:///Users/eachann/Library/Application%20Support/uTools/plugins/goose-note/fonts/NotoSansSC-Regular.ttf",
  );
  expect(url.includes("file:///fonts/")).toBeFalsy();
});

test("http dev server 解析相对路径不会变成磁盘根", () => {
  const url = resolvePdfFontUrl(
    PDF_FONT_RELATIVE_PATHS[1],
    "http://localhost:6001/",
  );
  expect(url).toBe("http://localhost:6001/fonts/NotoSansSC-Regular.otf");
});

test("带 hash 的 file:// 页面仍解析到插件目录", () => {
  const url = resolvePdfFontUrl(
    "fonts/NotoSansSC-Regular.otf",
    "file:///Users/x/dist/index.html#/workspace",
  );
  expect(url).toBe("file:///Users/x/dist/fonts/NotoSansSC-Regular.otf");
});

test("fileUrlToLocalPath 处理 Unix 与 Windows 盘符", () => {
  expect(fileUrlToLocalPath("file:///Users/x/dist/fonts/NotoSansSC-Regular.otf")).toBe(
    "/Users/x/dist/fonts/NotoSansSC-Regular.otf",
  );
  expect(fileUrlToLocalPath("file:///C:/plugins/goose-note/fonts/NotoSansSC-Regular.ttf")).toBe(
    "C:/plugins/goose-note/fonts/NotoSansSC-Regular.ttf",
  );
  expect(fileUrlToLocalPath("http://localhost:6001/fonts/x.ttf")).toBeNull();
});

test("注册给 react-pdf 的必须是 base64 data URL", () => {
  const src = toPdfFontDataUrl("AAEC");
  expect(src.startsWith("data:font/ttf;base64,")).toBeTruthy();
  expect(src.includes(";base64,")).toBeTruthy();
});

test("CJK 字体钉 fontsource static TTF，不用 woff2/otf", () => {
  expect(PDF_CJK_FONT_URLS[0]).toBe(
    "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.8/chinese-simplified-400-normal.ttf",
  );
  expect(PDF_CJK_FONT_URLS[1]).toBe(
    "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.1.0/chinese-simplified-400-normal.ttf",
  );
  for (const url of PDF_CJK_FONT_URLS) {
    expect(url.toLowerCase().endsWith(".ttf")).toBeTruthy();
    expect(url.toLowerCase().includes(".woff2")).toBeFalsy();
    expect(url.toLowerCase().includes(".otf")).toBeFalsy();
    expect(isEmbeddablePdfFontUrl(url)).toBeTruthy();
  }
});

const emptyCustomFonts = {
  default: { font: null },
  serif: { font: null },
  mono: { font: null },
};

test("default / 空 / HarmonyOS / ui-sans-serif 走 Noto TTF，不用鸿蒙 WOFF2", () => {
  const fromEmpty = resolvePdfFontPlan("default", emptyCustomFonts);
  expect(fromEmpty.embed).toBe("noto");
  expect(fromEmpty.bodyFamily).toBe(PDF_FONT_FAMILY);
  expect(fromEmpty.pageFontFamily).toBe(PDF_FONT_FAMILY);
  expect(fromEmpty.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);
  for (const url of fromEmpty.bodyUrls) {
    expect(url.toLowerCase().includes(".woff2")).toBeFalsy();
    expect(url.toLowerCase().endsWith(".ttf")).toBeTruthy();
  }

  const fromHarmony = resolvePdfFontPlan("default", {
    ...emptyCustomFonts,
    default: { font: "HarmonyOS Sans SC" },
  });
  expect(fromHarmony.embed).toBe("noto");
  expect(fromHarmony.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);

  const fromUiSans = resolvePdfFontPlan("default", {
    ...emptyCustomFonts,
    default: { font: "ui-sans-serif, HarmonyOS Sans SC" },
  });
  expect(fromUiSans.embed).toBe("noto");
  expect(fromUiSans.bodyUrls[0]).toBe(PDF_CJK_FONT_URLS[0]);
});

test("serif / 仓耳也走 Noto TTF，不嵌入 WOFF2", () => {
  const fromEmpty = resolvePdfFontPlan("serif", emptyCustomFonts);
  expect(fromEmpty.embed).toBe("noto");
  expect(fromEmpty.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);
  expect(fromEmpty.pageFontFamily).toBe(PDF_FONT_FAMILY);

  const fromName = resolvePdfFontPlan("default", {
    ...emptyCustomFonts,
    default: { font: '"仓耳今楷", serif' },
  });
  expect(fromName.embed).toBe("noto");
  expect(fromName.bodyUrls[0]).toBe(PDF_CJK_FONT_URLS[0]);
  expect(fromName.bodyUrls[0].toLowerCase().includes(".woff2")).toBeFalsy();
});

test("mono / DM Mono 选 DM Mono TTF + Noto TTF", () => {
  expect(PDF_DM_MONO_TTF_URLS[0]).toBe(
    "https://cdn.jsdelivr.net/fontsource/fonts/dm-mono@5.2.6/latin-400-normal.ttf",
  );
  for (const url of PDF_DM_MONO_TTF_URLS) {
    expect(url.toLowerCase().endsWith(".ttf")).toBeTruthy();
    expect(url.toLowerCase().includes(".woff2")).toBeFalsy();
  }

  const fromEmpty = resolvePdfFontPlan("mono", emptyCustomFonts);
  expect(fromEmpty.embed).toBe("dm-mono");
  expect(fromEmpty.monoUrls).toEqual([...PDF_DM_MONO_TTF_URLS]);
  expect(fromEmpty.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);
  expect(fromEmpty.pageFontFamily).toEqual(["DM Mono", PDF_FONT_FAMILY]);

  const fromName = resolvePdfFontPlan("mono", {
    ...emptyCustomFonts,
    mono: { font: "DM Mono" },
  });
  expect(fromName.embed).toBe("dm-mono");
});

test("未知系统字体走 Noto，不假装嵌入苹方/雅黑", () => {
  for (const font of ["苹方", "PingFang SC", "微软雅黑", "Microsoft YaHei"]) {
    const plan = resolvePdfFontPlan("default", {
      ...emptyCustomFonts,
      default: { font },
    });
    expect(plan.embed).toBe("noto");
    expect(plan.bodyFamily).toBe(PDF_FONT_FAMILY);
    expect(plan.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);
    expect(plan.pageFontFamily).toBe(PDF_FONT_FAMILY);
  }

  const serifSystem = resolvePdfFontPlan("serif", {
    ...emptyCustomFonts,
    serif: { font: "Georgia" },
  });
  expect(serifSystem.embed).toBe("noto");
  expect(serifSystem.bodyUrls).toEqual([...PDF_CJK_FONT_URLS]);
});

test("远程字体同会话只拉一次并转成 data URL", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const payload = new Uint8Array(120_000);
  payload.fill(1);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    const href = String(input);
    expect(href).toBe(PDF_CJK_FONT_URLS[0]);
    return new Response(payload, { status: 200 });
  }) as typeof fetch;

  try {
    const first = await loadPdfFontDataUrl();
    const second = await loadPdfFontDataUrl();
    expect(first).toBeTruthy();
    expect(first?.startsWith("data:font/ttf;base64,")).toBeTruthy();
    expect(second).toBe(first);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});

test("过小响应不缓存为成功", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("tiny", { status: 200 })) as typeof fetch;
  try {
    expect(await loadPdfFontDataUrl()).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});

test("主源失败则走备用 URL", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  const payload = new Uint8Array(120_000);
  payload.fill(2);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = String(input);
    seen.push(href);
    if (href === PDF_CJK_FONT_URLS[0]) {
      return new Response("nope", { status: 404 });
    }
    return new Response(payload, { status: 200 });
  }) as typeof fetch;

  try {
    const src = await loadPdfFontDataUrl();
    expect(seen).toEqual([...PDF_CJK_FONT_URLS]);
    expect(src?.startsWith("data:font/ttf;base64,")).toBeTruthy();
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});

test("WOFF2 不当作成功，也不去 fetch", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(new Uint8Array(120_000), { status: 200 });
  }) as typeof fetch;
  try {
    expect(isEmbeddablePdfFontUrl("https://cdn.example/HarmonyOS.woff2")).toBeFalsy();
    const src = await loadFirstPdfFontDataUrl([
      "https://cdn.example/HarmonyOS.woff2",
    ]);
    expect(src).toBeNull();
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});

test("ready 时 pageFontFamily 不是 Inter/Helvetica", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  const payload = new Uint8Array(120_000);
  payload.fill(3);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = String(input);
    expect(href.toLowerCase().includes(".woff2")).toBeFalsy();
    expect(href.toLowerCase().endsWith(".ttf")).toBeTruthy();
    return new Response(payload, { status: 200 });
  }) as typeof fetch;
  try {
    const result = await registerPdfFonts({
      fontFamily: "default",
      customFonts: emptyCustomFonts,
    });
    expect(result.ready).toBeTruthy();
    const family = Array.isArray(result.pageFontFamily)
      ? result.pageFontFamily.join(",")
      : result.pageFontFamily;
    expect(family).toBe(PDF_FONT_FAMILY);
    expect(family).not.toBe("Inter");
    expect(family).not.toBe("Helvetica");
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});

test("CJK TTF 失败时 ready=false，不是 Helvetica/Inter", async () => {
  resetPdfFontLoadCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 404 })) as typeof fetch;
  try {
    const result = await registerPdfFonts({ fontFamily: "default" });
    expect(result.ready).toBeFalsy();
    const family = Array.isArray(result.pageFontFamily)
      ? result.pageFontFamily.join(",")
      : result.pageFontFamily;
    expect(family).not.toBe("Helvetica");
    expect(family).not.toBe("Inter");
  } finally {
    globalThis.fetch = originalFetch;
    resetPdfFontLoadCache();
  }
});
