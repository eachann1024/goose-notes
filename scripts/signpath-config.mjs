#!/usr/bin/env node
// Decides whether a Desktop installers job signs Windows binaries through SignPath.
// Signing runs only for publishing runs (main schedule / workflow_dispatch) on Windows, and only once
// the SIGNPATH_API_TOKEN secret and the SIGNPATH_ORGANIZATION_ID variable exist. Otherwise the build
// keeps the unsigned path unchanged. Every SignPath Foundation signing request needs manual approval.
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const signing = resolveSigning(process.env);
  console.log(`Windows signing ${signing.enabled ? "enabled" : "skipped"}: ${signing.reason}`);
  const lines = Object.entries(signing).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
}
