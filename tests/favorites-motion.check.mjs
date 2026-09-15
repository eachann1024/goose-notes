import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL(
    "../src/pages/workspace/components/sidebar/FavoritesSection.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.match(source, /keyboardActivation\.current = event\.detail === 0/);
assert.match(source, /custom=\{keyboardActivation\.current\}/);
assert.match(source, /const instant = usePresenceData\(\) === true/);
assert.match(source, /instant\s*\? \{ duration: 0 \}/);
assert.match(source, /height: \{ duration: 0 \}/);
assert.match(source, /inert=\{!isPresent \|\| undefined\}/);
assert.match(source, /<div className="pt-0\.5">\{children\}<\/div>/);
assert.doesNotMatch(source, /className="overflow-hidden[^"\n]*pt-0\.5/);
assert.match(source, /focus-visible:outline-current/);
assert.match(source, /group-focus-visible:opacity-100/);
assert.equal(
  (
    readFileSync(
      new URL(
        "../src/pages/workspace/components/sidebar/Sidebar.tsx",
        import.meta.url,
      ),
      "utf8",
    ).match(/<FavoritesSection\b/g) ?? []
  ).length,
  1,
);
console.log("favorites motion guards passed");
