import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, test } from "playwright/test";

const url = "https://example.com/image.png";
const fetchData = "data:image/png;base64,ZmV0Y2g=";
const canvasData = "data:image/png;base64,Y2FudmFz";
const source = ts.transpileModule(
  readFileSync(new URL("../../src/lib/imageExport/remoteImageResolver.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function loadResolver(options: {
  bridge: () => Promise<string | null>;
  fetch: () => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;
}) {
  const events: string[] = [];
  const timers = new Map<number, () => void>();
  const delays: number[] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  const bridgeRequests: unknown[][] = [];
  let timerId = 0;
  const exports = {} as {
    resolveRemoteImageToDataUrl: (url: string) => Promise<string | null>;
  };
  runInNewContext(source, {
    exports,
    require: (id: string) => {
      if (id === "../imageStorage") return { imageStorage: {} };
      if (id === "../imageStorage/utils") return {
        blobToBase64: async () => { events.push("base64"); return fetchData; },
      };
      throw new Error(`Unexpected import: ${id}`);
    },
    AbortController,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++timerId;
      delays.push(delay);
      timers.set(id, callback);
      events.push(`timer:${id}`);
      return id;
    },
    clearTimeout: (id: number) => {
      events.push(`clear:${id}`);
      timers.delete(id);
    },
    window: { gooseFs: { fetchRemoteImage: (...args: unknown[]) => {
      bridgeRequests.push(args);
      events.push("bridge");
      return options.bridge();
    } } },
    fetch: async (requestUrl: string, init: RequestInit) => {
      requests.push({ url: requestUrl, init });
      events.push("fetch");
      const response = await options.fetch();
      return { ok: response.ok, blob: () => {
        events.push("blob");
        return response.blob();
      } };
    },
    Image: class {
      naturalWidth = 1;
      naturalHeight = 1;
      onload?: () => void;
      set src(value: string) {
        events.push(`image:${value}`);
        this.onload?.();
      }
    },
    document: { createElement: () => ({
      getContext: () => ({ drawImage: () => events.push("draw") }),
      toDataURL: () => canvasData,
    }) },
  });
  return { resolve: () => exports.resolveRemoteImageToDataUrl(url), events, timers, delays, requests, bridgeRequests };
}

test("remoteImageResolver clears fetch timeout before reading the response body", async () => {
  let finishBody!: (blob: Blob) => void;
  let bodyStarted!: () => void;
  const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
  const body = new Promise<Blob>((resolve) => { finishBody = resolve; });
  const runtime = loadResolver({
    bridge: async () => null,
    fetch: async () => ({ ok: true, blob: () => { bodyStarted(); return body; } }),
  });
  const result = runtime.resolve();
  await started;
  expect(runtime.events).toEqual(["bridge", "timer:1", "fetch", "clear:1", "blob"]);
  expect(runtime.timers.size).toBe(0);
  expect(runtime.delays).toEqual([8000]);
  expect(runtime.bridgeRequests).toEqual([[url, 8000]]);
  expect(runtime.requests).toHaveLength(1);
  expect(runtime.requests[0]).toMatchObject({ url, init: { mode: "cors", credentials: "omit" } });
  expect(runtime.requests[0].init.signal?.aborted).toBe(false);
  finishBody(new Blob(["image"], { type: "image/png" }));
  expect(await result).toBe(fetchData);
  expect(runtime.events.at(-1)).toBe("base64");
});

for (const outcome of ["rejected", "non-ok"] as const) {
  test(`remoteImageResolver clears ${outcome} fetch timeout before canvas fallback`, async () => {
    const runtime = loadResolver({
      bridge: async () => { throw new Error("bridge unavailable"); },
      fetch: async () => {
        if (outcome === "rejected") throw new Error("network failure");
        return { ok: false, blob: async () => { throw new Error("must not read body"); } };
      },
    });
    expect(await runtime.resolve()).toBe(canvasData);
    expect(runtime.events).toEqual([
      "bridge", "timer:1", "fetch", "clear:1", "timer:2", `image:${url}`, "clear:2", "draw",
    ]);
    expect(runtime.delays).toEqual([8000, 8000]);
    expect(runtime.timers.size).toBe(0);
    expect(runtime.requests[0].init.signal?.aborted).toBe(false);
  });
}

test("remoteImageResolver bridge success skips fetch and canvas", async () => {
  const runtime = loadResolver({
    bridge: async () => fetchData,
    fetch: async () => { throw new Error("must not fetch"); },
  });
  expect(await runtime.resolve()).toBe(fetchData);
  expect(runtime.events).toEqual(["bridge"]);
  expect(runtime.requests).toEqual([]);
  expect(runtime.timers.size).toBe(0);
});
