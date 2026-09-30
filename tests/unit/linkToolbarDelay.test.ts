import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("hovering a link waits 150ms before showing the toolbar", () => {
  const source = readFileSync(
    new URL(
      "../../src/components/editor/core/EditorComposer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(source).toContain("delay: { open: 150, close: 0 }");
});
