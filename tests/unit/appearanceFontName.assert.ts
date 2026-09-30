import assert from "node:assert/strict";
import {
  isLocalFontAvailable,
  normalizeLocalFontName,
} from "../../src/lib/fontLoader";

assert.equal(normalizeLocalFontName("PingFang SC "), "PingFang SC ");
assert.equal(normalizeLocalFontName("宋体"), "宋体");
assert.equal(normalizeLocalFontName("  "), null);
assert.equal(normalizeLocalFontName('Bad";color:red'), null);
assert.equal(normalizeLocalFontName("A".repeat(81)), null);

const originalFontFace = globalThis.FontFace;
globalThis.FontFace = class {
  constructor(
    _family: string,
    private source: string,
  ) {}
  async load() {
    if (!this.source.includes('local("PingFang SC")'))
      throw new Error("missing font");
    return this;
  }
} as unknown as typeof FontFace;
try {
  assert.equal(await isLocalFontAvailable("PingFang SC"), true);
  assert.equal(await isLocalFontAvailable("ThisFontDoesNotExist123"), false);
  assert.equal(await isLocalFontAvailable('Bad";color:red'), false);
  assert.equal(await isLocalFontAvailable("ui-sans-serif"), true);
} finally {
  globalThis.FontFace = originalFontFace;
}
