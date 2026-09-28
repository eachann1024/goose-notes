// Run: bun --tsconfig-override ./tsconfig.app.json tests/unit/setupGuideFlow.selfcheck.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canFinishSetupGuideAI } from "../../src/pages/workspace/components/SetupGuide";
import { isSetupGuideVisible } from "../../src/lib/setupGuide";
import type { SetupGuideAIStatus } from "../../src/lib/setupGuideAI";

const ready: SetupGuideAIStatus = { busy: false, dirty: false, ready: true };
assert.equal(canFinishSetupGuideAI(false, { busy: true, dirty: true, ready: false }), true);
assert.equal(canFinishSetupGuideAI(true, ready), true);
assert.equal(canFinishSetupGuideAI(true, { ...ready, busy: true }), false);
assert.equal(canFinishSetupGuideAI(true, { ...ready, dirty: true }), false);
assert.equal(canFinishSetupGuideAI(true, { ...ready, ready: false }), false);

assert.equal(isSetupGuideVisible({ _hasHydrated: false, setupGuideOpen: true, setupGuideSeen: false }), false);
assert.equal(isSetupGuideVisible({ _hasHydrated: true, setupGuideOpen: false, setupGuideSeen: false }), true);
assert.equal(isSetupGuideVisible({ _hasHydrated: true, setupGuideOpen: true, setupGuideSeen: true }), true);
assert.equal(isSetupGuideVisible({ _hasHydrated: true, setupGuideOpen: false, setupGuideSeen: true }), false);

const guide = readFileSync(new URL("../../src/pages/workspace/components/SetupGuide.tsx", import.meta.url), "utf8");
const appearance = readFileSync(new URL("../../src/pages/workspace/components/sidebar/SettingsAppearance.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/pages/workspace/components/setup-guide.css", import.meta.url), "utf8");
assert.doesNotMatch(guide, /<Dialog|DialogContent|DesktopTitleBar/);
assert.match(guide, /mode="onboarding"/);
assert.match(guide, /hasVisitedAI && \(/);
assert.match(guide, /hidden=\{step !== 2\}[\s\S]*?inert=\{step !== 2/);
assert.match(guide, /useLayoutEffect\(\(\) => \{[\s\S]*?headingRef\.current\?\.focus\(\)[\s\S]*?controlsRef\.current\.scrollTop = 0/);
assert.match(guide, /id="setup-guide-title" ref=\{headingRef\} tabIndex=\{-1\}/);
assert.match(guide, /setupGuideSeen: true, setupGuideOpen: false/);
assert.doesNotMatch(guide, /setAIEnabled\(false\)|clearPersistedPages|removeItem\(/);
assert.match(guide, /showDemoEnglish=\{false\}/);
assert.match(appearance, /section\?: "all" \| "appearance" \| "reading"/);
assert.match(appearance, /section = "all"/);
assert.match(appearance, /showPreview = true/);
assert.match(appearance, /<details className="setup-guide-advanced-settings/);
assert.match(styles, /grid-template-columns: minmax\(0, 11fr\) minmax\(0, 9fr\)/);
assert.match(styles, /"controls"\s+"preview"/);
assert.match(styles, /\.setup-guide \.settings-appearance-layout/);

console.log("PASS setup guide flow, persistence boundary, AI completion gate and responsive structure");
