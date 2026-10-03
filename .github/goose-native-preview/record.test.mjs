import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireSHA, isolatedEnv, summarize, checkSandbox, persistFatal, chooseCaptureSize, checkCaptureGeometry } from './record.mjs';

test('both checkout identities require exact full SHAs', () => {
  const sourceSHA = 'a'.repeat(40);
  requireSHA(sourceSHA, sourceSHA, 'Goose');
  assert.throws(() => requireSHA('other', sourceSHA, 'Goose'));
  assert.throws(() => requireSHA('fab5319', 'fab5319', 'Goose'));
});
test('initialization binds the requested app revision and post-build verification rejects a moved checkout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-revision-test-'));
  const source = path.join(root, 'app'); fs.mkdirSync(source);
  const recorderRoot = fileURLToPath(new URL('../../', import.meta.url));
  const recorder = fileURLToPath(new URL('./record.mjs', import.meta.url));
  const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
  const commit = value => {
    fs.writeFileSync(path.join(source, 'bun.lock'), value);
    git('add', 'bun.lock'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', value);
    return git('rev-parse', 'HEAD');
  };
  const run = (out, sha, command) => spawnSync(process.execPath, [recorder, command], {
    cwd: recorderRoot, encoding: 'utf8', env: { ...process.env, GOOSE_SOURCE: source, GOOSE_OUT: out,
      GOOSE_REF: 'requested-app', EXPECTED_SOURCE_SHA: sha,
      EXPECTED_RECORDER_SHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: recorderRoot, encoding: 'utf8' }).trim() },
  });
  try {
    git('init', '-q');
    const first = commit('first'); const out = path.join(root, 'first-evidence');
    assert.equal(run(out, '', 'init').status, 1, 'Missing expected app SHA must fail');
    assert.equal(run(out, '0'.repeat(40), 'init').status, 1, 'Wrong expected app SHA must fail');
    assert.equal(run(out, first, 'init').status, 0);
    const initial = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
    assert.equal(initial.sourceSHA, first); assert.equal(initial.sourceRef, 'requested-app');
    assert.equal(run(out, first, 'verify-source').status, 0);
    fs.writeFileSync(path.join(source, 'bun.lock'), 'modified by build');
    assert.equal(run(out, first, 'verify-source').status, 1, 'Tracked source/lock mutations must fail');
    git('checkout', '--', 'bun.lock');
    const second = commit('second');
    assert.equal(run(out, second, 'verify-source').status, 1, 'Manifest must remain bound to the first checkout');
    const secondOut = path.join(root, 'second-evidence');
    assert.equal(run(secondOut, second, 'init').status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(secondOut, 'manifest.json'))).sourceSHA, second);
    assert.equal(run(secondOut, second, 'verify-source').status, 0);
    assert.equal(run(secondOut, second, 'init').status, 1, 'Existing evidence must never be overwritten');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
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
  assert.match(text, /GOOSE_REF:.*github\.event\.inputs\.app_ref.*github\.event\.pull_request\.head\.sha.*github\.sha/);
  assert.match(text, /EXPECTED_SOURCE_SHA=.*rev-parse HEAD/);
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

test('standard runtime retains native sandboxing without changing OS security', () => {
  const script = fs.readFileSync(new URL('./record.mjs', import.meta.url), 'utf8');
  assert.match(script, /chromiumSandbox: true/);
  assert.match(script, /runtimeExternalNetworkBlocked: false/);
  assert.equal(script.includes("execFileSync('/usr/bin/sandbox-exec'"), false);
  assert.equal(/sudo |spctl |csrutil |tccutil |pfctl /.test(script), false);
});

test('small runner display selects an even canvas that fits the actual frame and work area', () => {
  assert.deepEqual(chooseCaptureSize({ width: 1024, height: 684 }, { width: 0, height: 22 }),
    { width: 992, height: 630 });
  assert.deepEqual(chooseCaptureSize({ width: 1920, height: 1080 }, { width: 0, height: 22 }),
    { width: 1440, height: 1000 });
  assert.deepEqual(chooseCaptureSize({ width: 1023, height: 705 }, { width: 1, height: 23 }),
    { width: 990, height: 650 });
  assert.throws(() => chooseCaptureSize({ width: 640, height: 480 }, { width: 0, height: 22 }), /too small/);
  assert.throws(() => chooseCaptureSize({ width: NaN, height: 768 }, { width: 0, height: 22 }), /Invalid display/);
});

test('native, renderer and video geometry must agree and remain entirely onscreen', () => {
  const size = { width: 992, height: 630 };
  const valid = { bounds: { x: 16, y: 40, width: 992, height: 652 }, contentSize: size,
    workArea: { x: 0, y: 24, width: 1024, height: 684 },
    renderer: { ...size, devicePixelRatio: 2, visibility: 'visible' } };
  checkCaptureGeometry(valid, size);
  assert.throws(() => checkCaptureGeometry({ ...valid, contentSize: { width: 1024, height: 684 } }, size), /Native content/);
  assert.throws(() => checkCaptureGeometry({ ...valid, renderer: { ...valid.renderer, width: 1440 } }, size), /Renderer/);
  assert.throws(() => checkCaptureGeometry({ ...valid, bounds: { ...valid.bounds, x: 50 } }, size), /entire native window/);
  assert.throws(() => checkCaptureGeometry({ ...valid, renderer: { ...valid.renderer, visibility: 'hidden' } }, size), /visible/);
});

test('recording sizes the real BrowserWindow and never fabricates a larger renderer viewport', () => {
  const script = fs.readFileSync(new URL('./record.mjs', import.meta.url), 'utf8');
  assert.equal(script.includes('page.setViewportSize('), false);
  assert.match(script, /w\.setContentSize\(size\.width, size\.height, false\)/);
  assert.match(script, /recordVideo: \{ dir: out, size: captureSize \}/);
  assert.match(script, /checkCaptureGeometry\(geometry, captureSize\)/);
  assert.match(script, /scale: 'css'/);
  assert.match(script, /checkpointHoldMs = 1200/);
});
