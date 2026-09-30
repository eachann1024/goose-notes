import { expect, test } from "playwright/test";
import {
  canonicalLocalPath,
  canonicalRelativePath,
  comparisonLocalPath,
  isCanonicalPathInside,
  stripSystemVolumesDataPrefix,
} from "../../src/lib/canonicalLocalPath";

test("strips /System/Volumes/Data prefix case-insensitively", () => {
  expect(stripSystemVolumesDataPrefix("/System/Volumes/Data/Users/foo/a.md")).toBe(
    "/Users/foo/a.md",
  );
  expect(stripSystemVolumesDataPrefix("/system/volumes/data/Users/foo")).toBe(
    "/Users/foo",
  );
});

test("treats firmlink paths as equal for comparison", () => {
  const users = "/Users/foo/a.md";
  const data = "/System/Volumes/Data/Users/foo/a.md";
  expect(comparisonLocalPath(users, true)).toBe(comparisonLocalPath(data, true));
});

test("isCanonicalPathInside works across firmlink prefixes", () => {
  expect(
    isCanonicalPathInside(
      "/System/Volumes/Data/Users/foo/notes/readme.md",
      "/Users/foo/notes",
      true,
    ),
  ).toBe(true);
});

test("canonicalRelativePath resolves across firmlink prefixes", () => {
  expect(
    canonicalRelativePath(
      "/Users/foo/notes",
      "/System/Volumes/Data/Users/foo/notes/readme.md",
      true,
    ),
  ).toBe("readme.md");
});

test("canonicalLocalPath normalizes slashes", () => {
  expect(canonicalLocalPath("\\\\Users\\foo\\a.md")).toBe("/Users/foo/a.md");
});
