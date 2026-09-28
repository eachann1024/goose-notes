// Run: bun --tsconfig-override tsconfig.app.json tests/unit/setupGuideAI.selfcheck.ts
import assert from "node:assert/strict";
import {
  areSetupGuideAIConnectionsEqual,
  canTestSetupGuideAI,
  getSetupGuideAIStatus,
  hasValidSetupGuideAIResponse,
  isSetupGuideAIRequestCurrent,
  redactSetupGuideAIError,
} from "../../src/lib/setupGuideAI";

const saved = {
  providerId: "custom-openai",
  baseURL: "https://api.example.test/v1/",
  apiKey: "fixture-secret-key",
};
const models = [{ id: "fixture-model" }];
const readyStatus = getSetupGuideAIStatus({
  busy: false,
  draft: { ...saved, baseURL: "https://api.example.test/v1" },
  saved,
  selectedModelId: "fixture-model",
  modelOptions: models,
});

assert.deepEqual(readyStatus, { busy: false, dirty: false, ready: true });
assert.equal(areSetupGuideAIConnectionsEqual(saved, {
  ...saved,
  baseURL: "https://api.example.test/v1",
}), true);
assert.equal(areSetupGuideAIConnectionsEqual(saved, { ...saved, apiKey: "other-key" }), false);
assert.equal(areSetupGuideAIConnectionsEqual(saved, { ...saved, baseURL: "https://other.example.test/v1" }), false);
assert.equal(canTestSetupGuideAI(true, readyStatus), true);
assert.equal(canTestSetupGuideAI(false, readyStatus), false);
assert.equal(
  canTestSetupGuideAI(true, { ...readyStatus, busy: true }),
  false,
);
assert.equal(
  getSetupGuideAIStatus({
    busy: false,
    draft: { ...saved, apiKey: "unsaved-key" },
    saved,
    selectedModelId: "fixture-model",
    modelOptions: models,
  }).dirty,
  true,
);
assert.equal(
  getSetupGuideAIStatus({
    busy: false,
    draft: saved,
    saved,
    selectedModelId: "missing-model",
    modelOptions: models,
  }).ready,
  false,
);
assert.equal(hasValidSetupGuideAIResponse("  OK  "), true);
assert.equal(hasValidSetupGuideAIResponse("  "), false, "empty responses fail");
assert.equal(
  redactSetupGuideAIError("provider echoed fixture-secret-key", saved.apiKey),
  "provider echoed [已隐藏]",
);

const controller = new AbortController();
const currentRequest = {
  requestId: 4,
  currentRequestId: 4,
  alive: true,
  signal: controller.signal,
};
assert.equal(isSetupGuideAIRequestCurrent(currentRequest), true);
assert.equal(
  isSetupGuideAIRequestCurrent({ ...currentRequest, currentRequestId: 5 }),
  false,
  "stale responses are ignored",
);
assert.equal(
  isSetupGuideAIRequestCurrent({ ...currentRequest, alive: false }),
  false,
  "unmounted responses are ignored",
);
controller.abort();
assert.equal(
  isSetupGuideAIRequestCurrent(currentRequest),
  false,
  "aborted responses are ignored",
);

console.log("PASS setup guide AI dirty/ready, failure, redaction, stale and abort checks");
