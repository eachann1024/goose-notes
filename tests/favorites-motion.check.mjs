import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync(new URL("../src/pages/workspace/components/sidebar/Sidebar.tsx", import.meta.url), "utf8");
assert.doesNotMatch(sidebar, /FavoritesSection|SidebarHeader/);
console.log("sidebar navigation removal guards passed");
