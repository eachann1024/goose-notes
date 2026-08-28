import { expect, test } from "playwright/test";
import { ensurePersistentRemoteFont } from "../../src/lib/fontLoader";

test("本机没有仓耳今楷时，用 FontFace url 安装，不 fetch arrayBuffer", async () => {
  const globals = globalThis as Record<string, unknown>;
  const originalDocument = globals.document;
  const originalFontFace = globals.FontFace;
  let addedFonts = 0;
  const sources: string[] = [];
  let loads = 0;

  class FontFaceStub {
    source: string;
    constructor(_family: string, source: string) {
      this.source = String(source);
      sources.push(this.source);
    }
    async load() {
      if (this.source.startsWith("local(")) {
        throw new Error("missing local font");
      }
      return this;
    }
  }

  globals.document = {
    fonts: {
      load: async () => {
        loads += 1;
        return [];
      },
      check: () => false,
      add: () => {
        addedFonts += 1;
      },
    },
  };
  globals.FontFace = FontFaceStub;

  try {
    await expect(ensurePersistentRemoteFont("仓耳今楷")).resolves.toBe(true);
    expect(loads).toBeGreaterThan(0);
    expect(sources.some((source) => source.startsWith("local("))).toBe(true);
    expect(sources.some((source) => source.startsWith("url("))).toBe(true);
    expect(addedFonts).toBe(1);
  } finally {
    globals.document = originalDocument;
    globals.FontFace = originalFontFace;
  }
});
