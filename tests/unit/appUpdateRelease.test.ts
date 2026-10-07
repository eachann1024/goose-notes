import { expect, test } from "playwright/test";
import {
  compareSemver,
  parseReleaseTag,
  pickUpdateAsset,
} from "../../src/lib/appUpdateRelease";

test("parses public release tags that include a commit suffix", () => {
  expect(parseReleaseTag("v9.0.11-b96400a")).toEqual({
    version: "9.0.11",
    tag: "v9.0.11-b96400a",
  });
});

test("compares semver without the commit suffix", () => {
  expect(compareSemver("9.0.11", "9.1.0")).toBeLessThan(0);
  expect(compareSemver("9.1.0", "v9.1.0-abc")).toBe(0);
});

test("picks the mac arm64 dmg and the intel dmg separately", () => {
  const assets = [
    { name: "Goose.Note-9.0.1-arm64.dmg", browser_download_url: "https://example/arm" },
    { name: "Goose.Note-9.0.1.dmg", browser_download_url: "https://example/intel" },
    { name: "Goose.Note-9.0.1-x64-setup.exe", browser_download_url: "https://example/win" },
    { name: "Goose.Note-9.0.1.AppImage", browser_download_url: "https://example/linux" },
  ];
  expect(pickUpdateAsset(assets, "darwin", "arm64")?.name).toBe(
    "Goose.Note-9.0.1-arm64.dmg",
  );
  expect(pickUpdateAsset(assets, "darwin", "x64")?.name).toBe(
    "Goose.Note-9.0.1.dmg",
  );
  expect(pickUpdateAsset(assets, "win32", "x64")?.name).toBe(
    "Goose.Note-9.0.1-x64-setup.exe",
  );
  expect(pickUpdateAsset(assets, "linux", "x64")?.name).toBe(
    "Goose.Note-9.0.1.AppImage",
  );
});

test("picks the Windows installer matching the CPU architecture", () => {
  const assets = [
    { name: "Goose.Note-9.0.1-arm64-setup.exe", browser_download_url: "https://example/win-arm" },
    { name: "Goose.Note-9.0.1-x64-setup.exe", browser_download_url: "https://example/win-x64" },
  ];
  expect(pickUpdateAsset(assets, "win32", "arm64")?.name).toBe("Goose.Note-9.0.1-arm64-setup.exe");
  expect(pickUpdateAsset(assets, "win32", "x64")?.name).toBe("Goose.Note-9.0.1-x64-setup.exe");
  // Older releases only had x64: ARM devices fall back to it, x64 never gets an arm64 build.
  expect(pickUpdateAsset(assets.slice(1), "win32", "arm64")?.name).toBe("Goose.Note-9.0.1-x64-setup.exe");
  expect(pickUpdateAsset(assets.slice(0, 1), "win32", "x64")).toBeNull();
});
