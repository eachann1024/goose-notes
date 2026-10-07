import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync(new URL('../../.github/workflows/desktop-build.yml', import.meta.url), 'utf8'));
assert.deepEqual(workflow.on.schedule, [{ cron: '0 7 */2 * *', timezone: 'Asia/Shanghai' }]);
assert.equal(Object.hasOwn(workflow.on, 'workflow_dispatch'), true);
assert.deepEqual(workflow.on.push, { 'branches-ignore': ['ui-previews'] });
assert.deepEqual(workflow.on.pull_request, { branches: ['main'] });
assert.equal(workflow.env.SOURCE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
assert.deepEqual(workflow.permissions, { contents: 'read' });
for (const job of ['source', 'build']) {
  assert.equal(workflow.jobs[job].if, "needs.prepare.outputs.build == 'true'");
  assert.equal(workflow.jobs[job].permissions, undefined);
  const checkout = workflow.jobs[job].steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ env.SOURCE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const upload = workflow.jobs[job].steps.find((step: { uses?: string; with?: { name?: string } }) =>
    step.uses?.startsWith('actions/upload-artifact@') && !step.with?.name?.startsWith('signpath-'));
  assert.equal(upload.with['retention-days'], 30);
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(upload.with.name.includes('env.SOURCE_SHA'));
}
assert.deepEqual(workflow.jobs.build.strategy.matrix.include.map((entry: { platform: string; arch: string }) => `${entry.platform}-${entry.arch}`).sort(),
  ['linux-x64', 'mac-arm64', 'mac-x64', 'win-arm64', 'win-x64']);
assert.equal(workflow.jobs.build.strategy['fail-fast'], false);
assert.equal(workflow.concurrency, undefined, 'Older commits must not be cancelled');
assert.equal(workflow.jobs.build.concurrency, undefined);
assert.equal(workflow.jobs.build.steps.some((step: { run?: string }) => step.run === 'bun run mac'), true);
assert.equal(workflow.jobs.release.if, "needs.prepare.outputs.publish == 'true' && github.ref == 'refs/heads/main'");
assert.deepEqual(workflow.jobs.release.needs, ['prepare', 'source', 'build']);
assert.equal(workflow.jobs.release.permissions.contents, 'write');

const script = workflow.jobs.prepare.steps[0].run;
const dir = mkdtempSync(join(tmpdir(), 'goose-release-cadence-'));
try {
  for (const [event, ref, latest, changed, build, publish] of [
    ['push', 'refs/heads/main', 'v10.0.0-abcdef0', '0', 'true', 'false'],
    ['push', 'refs/heads/feature', 'v10.0.0-abcdef0', '0', 'true', 'false'],
    ['pull_request', 'refs/pull/22/merge', '', '0', 'true', 'false'],
    ['schedule', 'refs/heads/main', 'v10.0.0-abcdef0', '0', 'false', 'false'],
    ['schedule', 'refs/heads/main', 'v9.9.3-1234567', '1', 'true', 'true'],
    ['schedule', 'refs/heads/main', 'v9.9.3-1234567', '0', 'false', 'false'],
    ['schedule', 'refs/heads/main', '', '1', 'true', 'true'],
    ['workflow_dispatch', 'refs/heads/main', 'v10.0.0-abcdef0', '0', 'true', 'true'],
    ['workflow_dispatch', 'refs/heads/feature', 'v10.0.0-abcdef0', '0', 'true', 'false'],
  ]) {
    const output = join(dir, 'output');
    writeFileSync(output, '');
    const result = spawnSync('bash', ['-e', '-c', `gh() { if [[ "$1" == release ]]; then echo "$MOCK_LATEST"; else echo "$MOCK_CHANGED"; fi; }\n${script}`], {
      env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_REPOSITORY: 'example/goose',
        GITHUB_SHA: 'abcdef0123456789', GITHUB_OUTPUT: output, MOCK_LATEST: latest, MOCK_CHANGED: changed },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8').trim(), `build=${build}\npublish=${publish}`, `${event} ${ref}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const collection = workflow.jobs.release.steps.find((step: { name?: string }) => step.name === 'Collect exact build assets for publication').run;
const artifacts = mkdtempSync(join(tmpdir(), 'goose-release-artifacts-'));
const sha = 'a'.repeat(40);
const prefixes = ['source', 'goose-note-win-x64', 'goose-note-win-arm64', 'goose-note-mac-arm64', 'goose-note-mac-x64', 'goose-note-linux-x64'];
try {
  for (const prefix of prefixes) {
    const path = join(artifacts, 'downloaded-artifacts', `${prefix}-${sha}`);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'LICENSE'), 'shared license');
    writeFileSync(join(path, 'BUILD.json'), prefix);
    writeFileSync(join(path, 'SHA256SUMS.txt'), 'hash');
    writeFileSync(join(path, `${prefix}.zip`), prefix);
  }
  const collect = () => spawnSync('bash', ['-e', '-c', collection], {
    cwd: artifacts, env: { ...process.env, SOURCE_SHA: sha }, encoding: 'utf8',
  });
  let result = collect();
  assert.equal(result.status, 0, result.stderr);
  for (const prefix of prefixes) assert.equal(readFileSync(join(artifacts, 'artifacts', `${prefix}-BUILD.json`), 'utf8'), prefix);
  assert.equal(readFileSync(join(artifacts, 'artifacts', 'LICENSE'), 'utf8'), 'shared license');
  rmSync(join(artifacts, 'artifacts'), { recursive: true });
  writeFileSync(join(artifacts, 'downloaded-artifacts', `goose-note-mac-x64-${sha}`, 'LICENSE'), 'conflicting license');
  result = collect();
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('Conflicting asset: LICENSE'), result.stderr);
  rmSync(join(artifacts, 'artifacts'), { recursive: true });
  rmSync(join(artifacts, 'downloaded-artifacts', `goose-note-win-x64-${sha}`), { recursive: true });
  result = collect();
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('Missing artifact:'), result.stderr);
} finally {
  rmSync(artifacts, { recursive: true, force: true });
}
// Windows runners default to core.autocrlf=true; .gitattributes keeps packaged notices and scripts LF
// so every platform builds from byte-identical sources.
const lfFiles = ['LICENSE', 'THIRD-PARTY-NOTICES.txt', 'SOURCE-CODE.md', 'scripts/prepare-electron-pack.mjs'];
const eolAttrs = spawnSync('git', ['check-attr', 'eol', '--', ...lfFiles], { encoding: 'utf8' });
assert.equal(eolAttrs.status, 0, eolAttrs.stderr);
assert.deepEqual(eolAttrs.stdout.trim().split('\n'), lfFiles.map(file => `${file}: eol: lf`));
// SignPath signing is pre-wired but must stay inert until configured, and only on Windows publishing runs.
const buildSteps = workflow.jobs.build.steps as { id?: string; name?: string; uses?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown>; run?: string }[];
const decide = buildSteps.find(step => step.id === 'signing');
assert.ok(decide?.run?.includes('scripts/signpath-config.mjs'));
assert.equal(decide?.env?.SIGNPATH_TOKEN_SET, "${{ secrets.SIGNPATH_API_TOKEN != '' }}", 'only the presence of the token is passed');
assert.equal(decide?.env?.PUBLISH, '${{ needs.prepare.outputs.publish }}');
assert.equal(buildSteps.find(step => step.name === 'Build installers and checksums')?.if, "steps.signing.outputs.enabled != 'true'");
const signSteps = buildSteps.filter(step => step.uses?.startsWith('signpath/'));
assert.equal(signSteps.length, 2, 'app exe and installer are signed separately');
for (const step of signSteps) {
  assert.match(step.uses!, /^signpath\/github-action-submit-signing-request@[0-9a-f]{40}$/, 'pin SignPath action to a full SHA');
  assert.equal(step.with?.['api-token'], '${{ secrets.SIGNPATH_API_TOKEN }}');
}
const signingIndex = buildSteps.indexOf(decide!);
for (const step of buildSteps.slice(signingIndex + 2)) {
  if (step.uses?.startsWith('actions/upload-artifact@') && step.with?.path === 'dist-desktop/ci/') break;
  if (step.name === 'Verify Arch package installs with dependencies') continue;
  assert.equal(step.if, "steps.signing.outputs.enabled == 'true'", `${step.name ?? step.uses} must only run when signing is enabled`);
}
const signpathSelfTest = spawnSync('node', ['scripts/signpath-config.mjs', '--self-test'], { encoding: 'utf8' });
assert.equal(signpathSelfTest.status, 0, signpathSelfTest.stderr);
// Release asset allowlist and rpm removal must stay in sync with what the build produces.
const buildJob = workflow.jobs.build.steps.map((step: { run?: string }) => step.run ?? '').join('\n');
assert.ok(!buildJob.includes(' rpm '), 'rpm is no longer built');
assert.match(readFileSync(new URL('../../scripts/build-ci-installers.mjs', import.meta.url), 'utf8'),
  /linux: \['AppImage', 'deb', 'pacman'\]/);
console.log('Push/PR builds, exact source, artifacts, permissions and scheduled publication checks passed.');
