import { expect, test } from "playwright/test";
import { isInternalAssetRef } from "../../src/lib/internalAssetRef";
import { isLocalFilePath } from "../../src/lib/imageStorage/strategies/file-system";

test("isInternalAssetRef 覆盖四类前缀，且 att: 不误伤 att-file / att-video", () => {
  expect(isInternalAssetRef("att:goose-img/x")).toBe(true);
  expect(isInternalAssetRef("att-file:goose-file/x")).toBe(true);
  expect(isInternalAssetRef("att-video:goose-video/x")).toBe(true);
  expect(isInternalAssetRef("uuid:abc")).toBe(true);
  expect(isInternalAssetRef("./assets/x.png")).toBe(false);
  expect(isInternalAssetRef("https://example.com/x.png")).toBe(false);
});

test("isLocalFilePath 不把内部引用当成本地路径", () => {
  expect(isLocalFilePath("att:goose-img/x.png")).toBe(false);
  expect(isLocalFilePath("att-file:goose-file/report.pdf")).toBe(false);
  expect(isLocalFilePath("att-video:goose-video/clip.mp4")).toBe(false);
  expect(isLocalFilePath("uuid:abc")).toBe(false);
  expect(isLocalFilePath("./assets/x.png")).toBe(true);
});
