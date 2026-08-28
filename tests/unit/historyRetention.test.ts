import { expect, test } from "playwright/test";
import { selectEvictedVersionIds } from "../../src/lib/history/retention";

test("history retention never selects milestone versions for eviction", () => {
  const versions = [
    { versionId: "m1", isMilestone: true },
    { versionId: "old", isMilestone: false },
    { versionId: "m2", isMilestone: true },
    { versionId: "newer", isMilestone: false },
  ];

  for (let i = 0; i < 50; i += 1) {
    versions.push({ versionId: `n${i}`, isMilestone: false });
  }

  const evicted = selectEvictedVersionIds(versions);
  expect(evicted).toContain("old");
  expect(evicted).not.toContain("m1");
  expect(evicted).not.toContain("m2");
});

test("history retention keeps extra versions when they are all milestones", () => {
  const versions = Array.from({ length: 52 }, (_, index) => ({
    versionId: `m${index}`,
    isMilestone: true,
  }));

  expect(selectEvictedVersionIds(versions)).toEqual([]);
});
