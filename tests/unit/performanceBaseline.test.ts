import { performance } from "node:perf_hooks";
import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { getPageTitle } from "../../src/components/editor/utils/page-title";
import {
  resetIndex,
  searchIndex,
  syncIndex,
} from "../../src/pages/workspace/components/command/pageSearchIndex";

const WARMUPS = 2;
const SAMPLES = 5;
const QUERY_REPEATS = 10;

function syntheticPage(index: number, bodyBlocks: number): Page {
  return {
    id: `page-${index}`,
    workspaceId: "synthetic-notebook",
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: `Synthetic ${index}`, styles: {} }],
      },
      ...Array.from({ length: bodyBlocks }, (_, block) => ({
        type: "paragraph",
        content: [{
          type: "text",
          text: `baselinebody 笔记 project${index} section${block}${index === 0 && block === 0 ? " uniqueneedle" : ""}`,
          styles: {},
        }],
      })),
    ],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
  };
}

// Setup/reset and assertions are outside timing; each sample times the whole batch.
function medianMs(run: () => void, prepare: () => void = () => {}): number {
  const samples: number[] = [];
  for (let iteration = 0; iteration < WARMUPS + SAMPLES; iteration++) {
    prepare();
    const start = performance.now();
    run();
    const elapsed = performance.now() - start;
    if (iteration >= WARMUPS) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

test.afterEach(() => resetIndex());

test("synthetic title extraction and search index performance baseline", () => {
  resetIndex();
  const rows: {
    operation: string;
    pages: number;
    bodyBlocksPerPage: number;
    callsPerSample: number;
    medianMsPerSample: number;
  }[] = [];

  // ponytail: in-memory API microbenchmark only; add UI/IPC/storage timing in E2E.
  // Catalog is excluded: importing it also initializes persistent notebook stores.
  // Body size and page count vary independently; no random data or user files.
  for (const [pageCount, bodyBlocks] of [
    [100, 8], [500, 8], [1000, 8], [100, 1], [100, 64],
  ]) {
    const pages = Array.from({ length: pageCount }, (_, i) => syntheticPage(i, bodyBlocks));
    const record = Object.fromEntries(pages.map((page) => [page.id, page]));
    const expectedIds = pages.map((page) => page.id).sort();
    let titles: string[] = [];
    rows.push({
      operation: "getPageTitle: all internal pages",
      pages: pageCount,
      bodyBlocksPerPage: bodyBlocks,
      callsPerSample: pageCount,
      medianMsPerSample: medianMs(() => {
        titles = pages.map(getPageTitle);
      }),
    });
    expect(titles).toEqual(pages.map((_, i) => `Synthetic ${i}`));

    rows.push({
      operation: "syncIndex: empty index build",
      pages: pageCount,
      bodyBlocksPerPage: bodyBlocks,
      callsPerSample: 1,
      medianMsPerSample: medianMs(() => syncIndex(record), resetIndex),
    });
    expect(searchIndex("uniqueneedle")).toEqual(["page-0"]);
    expect(searchIndex("baselinebody").sort()).toEqual(expectedIds);

    rows.push({
      operation: "syncIndex: unchanged full snapshot scan",
      pages: pageCount,
      bodyBlocksPerPage: bodyBlocks,
      callsPerSample: 1,
      medianMsPerSample: medianMs(() => syncIndex(record)),
    });
    expect(searchIndex("baselinebody").sort()).toEqual(expectedIds);

    for (const [query, expected] of [
      ["uniqueneedle", ["page-0"]],
      ["baselineb", expectedIds],
      ["笔", expectedIds],
      ["zzzznonexistentzzzz", []],
    ] as const) {
      let result: string[] = [];
      rows.push({
        operation: `searchIndex: ${query}`,
        pages: pageCount,
        bodyBlocksPerPage: bodyBlocks,
        callsPerSample: QUERY_REPEATS,
        medianMsPerSample: medianMs(() => {
          for (let repeat = 0; repeat < QUERY_REPEATS; repeat++) {
            result = searchIndex(query);
          }
        }),
      });
      expect(result.sort()).toEqual(expected);
    }
  }

  console.log(
    `API microbenchmark (not UI input latency): Node ${process.version}, ${process.platform}/${process.arch}; ` +
    `${WARMUPS} warmups + ${SAMPLES} samples per row; median milliseconds for the entire callsPerSample batch. ` +
    "Each page has one H1 plus bodyBlocksPerPage paragraphs; fixture creation, resets and assertions excluded. " +
    "No timing pass/fail thresholds. Empty index build is warm-process, not process startup.",
  );
  console.table(rows);
});
