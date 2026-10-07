#!/usr/bin/env node
// Decides whether a Desktop installers job signs Windows binaries through SignPath.
// Signing runs only for publishing runs (main schedule / workflow_dispatch) on Windows, and only once
// the SIGNPATH_API_TOKEN secret and the SIGNPATH_ORGANIZATION_ID variable exist. Otherwise the build
// keeps the unsigned path unchanged. Every SignPath Foundation signing request needs manual approval.
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SIGNPATH_DEFAULTS = {
  projectSlug: "goose-notes",
  signingPolicySlug: "release-signing",
  appArtifactConfigurationSlug: "app-exe",
  installerArtifactConfigurationSlug: "installer",
};

export function resolveSigning(env) {
  const base = { enabled: false, reason: "" };
  if (env.PLATFORM !== "win") return { ...base, reason: "not a Windows build" };
  if (env.PUBLISH !== "true") return { ...base, reason: "not a publishing run" };
  if (env.SIGNPATH_TOKEN_SET !== "true") return { ...base, reason: "SIGNPATH_API_TOKEN secret not configured" };
  const organizationId = env.SIGNPATH_ORGANIZATION_ID?.trim();
  if (!organizationId) return { ...base, reason: "SIGNPATH_ORGANIZATION_ID variable not configured" };
  const pick = (value, fallback) => value?.trim() || fallback;
  return {
    enabled: true,
    reason: "SignPath configured",
    organizationId,
    projectSlug: pick(env.SIGNPATH_PROJECT_SLUG, SIGNPATH_DEFAULTS.projectSlug),
    signingPolicySlug: pick(env.SIGNPATH_SIGNING_POLICY_SLUG, SIGNPATH_DEFAULTS.signingPolicySlug),
    appArtifactConfigurationSlug: pick(env.SIGNPATH_APP_ARTIFACT_CONFIGURATION_SLUG, SIGNPATH_DEFAULTS.appArtifactConfigurationSlug),
    installerArtifactConfigurationSlug: pick(env.SIGNPATH_INSTALLER_ARTIFACT_CONFIGURATION_SLUG, SIGNPATH_DEFAULTS.installerArtifactConfigurationSlug),
  };
}

function selfTest() {
  const ready = { PLATFORM: "win", PUBLISH: "true", SIGNPATH_TOKEN_SET: "true", SIGNPATH_ORGANIZATION_ID: "org-1" };
  assert.deepEqual(resolveSigning(ready), {
    enabled: true, reason: "SignPath configured", organizationId: "org-1", ...SIGNPATH_DEFAULTS,
  });
  assert.equal(resolveSigning({ ...ready, SIGNPATH_PROJECT_SLUG: " custom " }).projectSlug, "custom");
  assert.equal(resolveSigning({ ...ready, PLATFORM: "mac" }).enabled, false);
  assert.equal(resolveSigning({ ...ready, PLATFORM: "linux" }).enabled, false);
  assert.equal(resolveSigning({ ...ready, PUBLISH: "false" }).enabled, false, "push/PR builds never sign");
  assert.equal(resolveSigning({ ...ready, SIGNPATH_TOKEN_SET: "false" }).enabled, false, "missing secret skips signing");
  assert.equal(resolveSigning({ ...ready, SIGNPATH_ORGANIZATION_ID: "" }).enabled, false, "missing org id skips signing");
  assert.equal(resolveSigning({ ...ready, SIGNPATH_ORGANIZATION_ID: undefined }).enabled, false);
  console.log("SignPath switch checks passed.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const signing = resolveSigning(process.env);
  console.log(`Windows signing ${signing.enabled ? "enabled" : "skipped"}: ${signing.reason}`);
  const lines = Object.entries(signing).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
}
