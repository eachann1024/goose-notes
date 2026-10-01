import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceSHA, requireSHA, isolatedEnv, summarize, checkSandbox, persistFatal, networkPolicy } from './record.mjs';

test('both checkout identities require exact full SHAs', () => {
  requireSHA(sourceSHA, sourceSHA, 'Goose');
  assert.throws(() => requireSHA('other', sourceSHA, 'Goose'));
  assert.throws(() => requireSHA('fab5319', 'fab5319', 'Goose'));
});
test('runtime environment does not inherit keys, home or application configuration', () => {
  const env = isolatedEnv('/tmp/disposable', { PATH: '/bin', TMPDIR: '/tmp/runner-tmp', HOME: '/real', GITHUB_TOKEN: 'not-a-real-token', ELECTRON_RENDERER_URL: 'https://external.invalid', NODE_OPTIONS: '--require=bad' });
  assert.equal(env.HOME, '/tmp/disposable'); assert.equal(env.TMPDIR, '/tmp/runner-tmp');
  for (const k of ['GITHUB_TOKEN', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS']) assert.equal(k in env, false);
});
test('sandbox requirements reject weaker renderer preferences and launch switches', () => {
  const valid = { sandboxed: true, contextIsolated: true, nodeIntegration: false, argv: ['electron', 'app'] };
  checkSandbox(valid);
  for (const changes of [{ sandboxed: false }, { contextIsolated: false }, { nodeIntegration: true }, { argv: ['--no-sandbox'] }, { argv: ['--disable-setuid-sandbox'] }]) assert.throws(() => checkSandbox({ ...valid, ...changes }));
});
test('a preflight failure cannot become a passing product recording', () => {
  const m = { status: 'passed', stages: { preflight: 'failed', build: 'passed', record: 'passed' } };
  assert.equal(summarize(m, 'success', []).status, 'failed');
  assert.equal(summarize({ status: 'passed', stages: { preflight: 'passed', build: 'passed', record: 'passed' } }, 'failure', []).status, 'failed');
});
test('workflow preflights before build and preserves the isolation and audience', () => {
  const text = fs.readFileSync(new URL('../workflows/goose-native-preview.yml', import.meta.url), 'utf8');
  assert.ok(text.indexOf('runtime preflight') < text.indexOf('bun run mac'));
  assert.match(text, /runs-on: macos-15/);
  assert.match(text, /timeout-minutes: 15/);
  assert.match(text, /github.event.repository.private == false/);
  assert.match(text, /contents: read/); assert.match(text, /retention-days: 7/);
  assert.equal(/pull_request_target|pages:|contents: write|--privileged|seccomp=unconfined|--no-sandbox/.test(text), false);
  assert.match(text, new RegExp(sourceSHA));
  assert.equal(text.includes('${{ runner.temp }}'), false, 'Runner context is unavailable in job env');
});

test('finalization resolves running stages without inventing unstarted results', () => {
  const m = { status: 'initialized', stages: { dependencies: 'passed', preflight: 'running' } };
  summarize(m, 'failure', []);
  assert.equal(m.stages.preflight, 'failed'); assert.equal(m.stages.build, undefined);
});
test('successful evidence requires a post-build clean source check', () => {
  const m = { status: 'passed', stages: { preflight: 'passed', build: 'passed', record: 'passed' } };
  assert.equal(summarize({ ...m }, 'success', []).status, 'failed');
  assert.equal(summarize({ ...m, sourceDirtyAfterBuild: false }, 'success', []).status, 'passed');
});

test('fatal launch observer preserves diagnostics without turning failure into success', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-fatal-test-'));
  try {
    const file = path.join(root, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify({ status: 'initialized', errors: [], stages: { preflight: 'running' } }));
    persistFatal(file, new Error('launch failed'), 'unhandledRejection');
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(m.status, 'failed'); assert.equal(m.stages.preflight, 'failed');
    assert.deepEqual(m.errors, ['launch failed']); assert.equal(m.fatalOrigin, 'unhandledRejection');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime policy keeps direct outbound traffic limited to loopback', () => {
  assert.match(networkPolicy, /\(deny network\*\)/);
  assert.match(networkPolicy, /\(allow network-outbound \(remote ip "localhost:\*"\)\)/);
  assert.equal(networkPolicy.includes('(remote ip "*:*"'), false);
  assert.equal(networkPolicy.includes('(allow network-outbound (local ip'), false);
  assert.match(networkPolicy, /\(deny appleevent-send\)/);
  assert.match(networkPolicy, /\(deny lsopen\)/);
});
