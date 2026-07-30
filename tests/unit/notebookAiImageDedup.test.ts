import { expect, test } from "vitest";
import {
  calculateImageSha256,
  getImageFastFingerprint,
  ImageDedupTracker,
} from "../../src/components/editor/ai/composer/imageDedup";

function imageFile(
  content: string,
  name: string,
  options: { type?: string; lastModified?: number } = {},
): File {
  return new File([content], name, {
    type: options.type ?? "image/png",
    lastModified: options.lastModified ?? 100,
  });
}

test("fast fingerprint includes name, size, lastModified and type", () => {
  const base = imageFile("same", "a.png");
  expect(getImageFastFingerprint(imageFile("same", "b.png"))).not.toBe(
    getImageFastFingerprint(base),
  );
  expect(
    getImageFastFingerprint(imageFile("longer", "a.png")),
  ).not.toBe(getImageFastFingerprint(base));
  expect(
    getImageFastFingerprint(imageFile("same", "a.png", { lastModified: 101 })),
  ).not.toBe(getImageFastFingerprint(base));
  expect(
    getImageFastFingerprint(imageFile("same", "a.png", { type: "image/jpeg" })),
  ).not.toBe(getImageFastFingerprint(base));
});

test("fast duplicate is rejected immediately and can be claimed after release", () => {
  const tracker = new ImageDedupTracker();
  const first = imageFile("first", "same.png");
  const duplicateMetadata = imageFile("other", "same.png");

  expect(tracker.claim("first", first)).toBe(true);
  expect(tracker.claim("second", duplicateMetadata)).toBe(false);
  tracker.release("first");
  expect(tracker.claim("second", duplicateMetadata)).toBe(true);
});

test("content hash resolution rejects the later image regardless of hash completion order", () => {
  const tracker = new ImageDedupTracker();
  expect(tracker.claim("first", imageFile("same", "first.png"))).toBe(true);
  expect(tracker.claim("second", imageFile("same", "second.png"))).toBe(true);

  expect(tracker.resolveContentHash("second", "shared-hash")).toBeNull();
  expect(tracker.resolveContentHash("first", "shared-hash")).toBe("second");
  tracker.release("second");
  expect(tracker.has("second")).toBe(false);
});

test("hash completion after chip deletion is ignored", () => {
  const tracker = new ImageDedupTracker();
  expect(tracker.claim("deleted", imageFile("same", "deleted.png"))).toBe(true);
  tracker.release("deleted");

  expect(tracker.resolveContentHash("deleted", "hash")).toBeNull();
});

test("SHA-256 identifies equal content with different metadata", async () => {
  const first = imageFile("same bytes", "first.png");
  const second = imageFile("same bytes", "second.png", { lastModified: 200 });

  const firstHash = await calculateImageSha256(first);
  const secondHash = await calculateImageSha256(second);
  if (globalThis.crypto?.subtle) {
    expect(firstHash).not.toBeNull();
    expect(secondHash).toBe(firstHash);
  } else {
    expect(firstHash).toBeNull();
    expect(secondHash).toBeNull();
  }
});
