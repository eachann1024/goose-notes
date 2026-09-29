import { expect, test } from "playwright/test";
import { shell } from "../../src/lib/electron-platform/shell";
import type { LocalFolderOpenAppCandidate } from "../../src/lib/local-folder-open-apps";

test("本地打开应用列表合并并发请求并缓存成功结果", async () => {
  let resolveRequest!: (items: LocalFolderOpenAppCandidate[]) => void;
  let calls = 0;
  Object.assign(globalThis, {
    window: {
      gooseFs: {
        listAvailableOpenApps: () => {
          calls += 1;
          return new Promise<LocalFolderOpenAppCandidate[]>((resolve) => {
            resolveRequest = resolve;
          });
        },
      },
    },
  });
  const candidates = [{ appName: `dedupe-${crypto.randomUUID()}` }];
  const first = shell.listAvailableOpenApps(candidates);
  const second = shell.listAvailableOpenApps(candidates);
  expect(calls).toBe(1);
  resolveRequest([{ ...candidates[0], icon: "data:image/png;base64,test" }]);
  expect(await first).toEqual(await second);
  expect(await shell.listAvailableOpenApps(candidates)).toEqual(await first);
  expect(calls).toBe(1);
});

test("本地打开应用空结果不缓存，后续请求可以重试", async () => {
  let calls = 0;
  Object.assign(globalThis, {
    window: {
      gooseFs: {
        listAvailableOpenApps: async (candidates: LocalFolderOpenAppCandidate[]) => {
          calls += 1;
          return calls === 1 ? [] : candidates;
        },
      },
    },
  });
  const candidates = [{ appName: `retry-${crypto.randomUUID()}` }];
  expect(await shell.listAvailableOpenApps(candidates)).toEqual([]);
  expect(await shell.listAvailableOpenApps(candidates)).toEqual(candidates);
  expect(calls).toBe(2);
});
