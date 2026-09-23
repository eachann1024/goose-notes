import { strict as assert } from "node:assert";
import { fittingBreadcrumb } from "../../src/pages/workspace/components/command/fittingBreadcrumb";

const parts = ["agents", "skills-project", "make-report-pages"];
const width = (part: string) => part.length * 10;
assert.deepEqual(fittingBreadcrumb(parts, 0, width), []);
assert.deepEqual(fittingBreadcrumb(parts, 160, width), []);
assert.deepEqual(fittingBreadcrumb(parts, 170, width), [2]);
assert.deepEqual(fittingBreadcrumb(parts, 350, width), [1, 2]);
assert.deepEqual(fittingBreadcrumb(parts, 410, width), [0, 1, 2]);
