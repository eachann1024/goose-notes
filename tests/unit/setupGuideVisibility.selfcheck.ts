import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSetupGuideVisible } from "../../src/lib/setupGuide";

for (const hydrated of [false, true]) {
  for (const seen of [false, true]) {
    for (const open of [false, true]) {
      const settings = { _hasHydrated: hydrated, setupGuideSeen: seen, setupGuideOpen: open };
      const before = { ...settings };
      assert.equal(isSetupGuideVisible(settings), hydrated && (open || !seen));
      assert.deepEqual(settings, before, "Checking visibility must not reset saved settings");
    }
  }
}
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
assert.match(app, /workspaceOpened \|\| \(settingsHydrated && !showSetupGuide\)/);
assert.match(app, /hidden=\{showSetupGuide\} inert=\{showSetupGuide\}/);
for (const file of ["useAppHotkeys.ts", "useDesktopHotkeys.ts"]) {
  const source = readFileSync(new URL("../../src/hooks/" + file, import.meta.url), "utf8");
  assert.match(source, /isSetupGuideVisible\(useSettings\.getState\(\)\)/);
}
console.log("PASS setup guide: hydration, first-run/reopen visibility, editor retention and workspace shortcut guards");
