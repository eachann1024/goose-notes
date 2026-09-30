import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Icons from "../../src/components/ui/icons";
import { resolvePageIcon } from "../../src/lib/resolvePageIcon";

test("decorative icons stay hidden; explicitly labelled icons retain their name", () => {
  expect(renderToStaticMarkup(<Icons.Folder size={16} />)).toContain('aria-hidden="true"');
  const labelled = renderToStaticMarkup(<Icons.Export aria-label="导出笔记" />);
  expect(labelled).toContain('aria-label="导出笔记"');
  expect(labelled).not.toContain('aria-hidden="true"');
});
test("persisted known and legacy custom names render without rewriting keys", () => {
  expect(resolvePageIcon("Folder")).toBe(Icons.Folder);
  for (const name of ["Flame", "Rocket", "Bell", "Bug", "MapPin"]) {
    const Icon = resolvePageIcon(name);
    expect(Icon, name).toBeTruthy();
    expect(renderToStaticMarkup(React.createElement(Icon!))).toContain("<svg");
  }
  expect(resolvePageIcon("missing-custom-name")).toBeNull();
});
test("milestone star keeps a genuinely filled silhouette", () => {
  const regular = renderToStaticMarkup(<Icons.Star />);
  const filled = renderToStaticMarkup(<Icons.Star fill="currentColor" />);
  expect(filled).not.toBe(regular);
  expect(filled).not.toContain('fill="none"');
});
