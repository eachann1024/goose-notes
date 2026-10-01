import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
// Self-contained evidence utilities; no external repository or private files are loaded.
export function hashFile(file) {
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
}
export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${file}.tmp`, file);
}
export function failManifest(manifest, error) {
  manifest.status = 'failed';
  manifest.errors.push(error instanceof Error ? error.message : String(error));
}
export async function withDeadline(operation, milliseconds) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation exceeded ${milliseconds}ms deadline`)), milliseconds);
  })]); } finally { clearTimeout(timer); }
}

export const sourceSHA = 'fab53195d172c6ae008c8da9fe4d32716eba550a';
export const viewport = { width: 1440, height: 1000 };
export function requireSHA(actual, expected, name) {
  assert.match(expected || '', /^[a-f0-9]{40}$/, `${name} requires a full SHA`);
  assert.equal(actual, expected, `${name} checkout mismatch`);
}
export function isolatedEnv(profile, inherited = process.env) {
  const env = Object.fromEntries(['PATH', 'TMPDIR'].filter(k => inherited[k]).map(k => [k, inherited[k]]));
  return { ...env, HOME: profile, XDG_CONFIG_HOME: `${profile}/config`, XDG_DATA_HOME: `${profile}/data`,
    XDG_CACHE_HOME: `${profile}/cache`, LANG: 'zh_CN.UTF-8', LC_ALL: 'en_US.UTF-8', CI: '1' };
}
export function summarize(manifest, status, artifacts) {
  manifest.workflowStatus = status;
  manifest.finishedAt = new Date().toISOString();
  manifest.artifacts = artifacts;
  if (status !== 'success') {
    for (const key of Object.keys(manifest.stages)) if (manifest.stages[key] === 'running') manifest.stages[key] = status === 'cancelled' ? 'cancelled' : 'failed';
  }
  if (status !== 'success' || manifest.stages.preflight !== 'passed' || manifest.stages.build !== 'passed' || manifest.stages.record !== 'passed' || manifest.sourceDirtyAfterBuild !== false) manifest.status = 'failed';
  return manifest;
}
export function persistFatal(manifestFile, error, origin) {
  if (!fs.existsSync(manifestFile)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  failManifest(manifest, error);
  manifest.fatalOrigin = origin;
  for (const key of Object.keys(manifest.stages)) if (manifest.stages[key] === 'running') manifest.stages[key] = 'failed';
  writeJSON(manifestFile, manifest);
}
export function checkSandbox(info) {
  assert.equal(info.sandboxed, true, 'Renderer sandbox must remain enabled');
  assert.equal(info.contextIsolated, true, 'Context isolation must remain enabled');
  assert.equal(info.nodeIntegration, false, 'Node integration must remain disabled');
  assert.equal(info.argv.some(arg => /^(--no-sandbox|--disable-setuid-sandbox|--disable-web-security)(=|$)/.test(arg)), false, 'Unsafe Chromium argument');
}

export const networkPolicy = `(version 1)
(allow default)
(deny network*)
(allow network-bind (local ip "localhost:*"))
(allow network-inbound (local ip "localhost:*"))
(allow network-outbound (remote ip "localhost:*"))
(allow network-bind (local unix-socket (subpath (param "RUN_ROOT"))))
(allow network-outbound (remote unix-socket (subpath (param "RUN_ROOT"))))
(deny appleevent-send)
(deny lsopen)
`;
export async function probeNetwork() {
  const server = net.createServer(socket => socket.end('loopback-probe'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let localData = '';
  try {
    await withDeadline(() => new Promise((resolve, reject) => {
      const socket = net.connect(server.address().port, '127.0.0.1');
      socket.on('data', data => { localData += data.toString(); });
      socket.once('end', resolve); socket.once('error', reject);
    }), 3000);
    assert.equal(localData, 'loopback-probe');
  } finally { server.close(); }
  const external = await new Promise(resolve => {
    // TEST-NET-3, reserved for documentation. No user data or application request is sent.
    const socket = net.connect({ host: '203.0.113.1', port: 443 });
    socket.setTimeout(3000);
    const done = result => { socket.destroy(); resolve(result); };
    socket.once('connect', () => done('CONNECTED'));
    socket.once('error', error => done(error.code));
    socket.once('timeout', () => done('TIMEOUT'));
  });
  assert.ok(['EPERM', 'EACCES'].includes(external), `Direct non-loopback socket was not denied by policy: ${external}`);
  return { loopbackTCP: 'passed', directNonLoopbackSocket: external, note: 'Socket restriction, not a separate network namespace or a guarantee about system XPC proxies' };
}

async function main(command) {
  const source = path.resolve(process.env.GOOSE_SOURCE || 'goose-source');
  const out = path.resolve(process.env.GOOSE_OUT || path.join(os.tmpdir(), 'goose-native-out'));
  const manifestFile = path.join(out, 'manifest.json');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  if (command === 'restricted') {
    assert.equal(process.platform, 'darwin', 'macOS-only runtime wrapper');
    assert.ok(['preflight', 'record'].includes(process.argv[3]));
    const runRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'goose-runtime-')));
    fs.mkdirSync(path.join(runRoot, 'tmp'));
    const policyFile = path.join(runRoot, 'runtime.sb'); fs.writeFileSync(policyFile, networkPolicy);
    fs.writeFileSync(path.join(out, 'runtime-policy.sb'), networkPolicy);
    const before = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    before.networkPolicySHA256 = hashFile(policyFile); before.stages[process.argv[3]] = 'running';
    writeJSON(manifestFile, before);
    const env = {
      ...isolatedEnv(path.join(runRoot, 'home')),
      TMPDIR: `${runRoot}/tmp/`, GOOSE_SOURCE: source, GOOSE_OUT: out,
      GOOSE_RUNTIME_POLICY: hashFile(policyFile), DEBUG: 'pw:browser',
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
    };
    try {
      execFileSync('/usr/bin/sandbox-exec', ['-D', `RUN_ROOT=${runRoot}`, '-f', policyFile, process.execPath,
        fileURLToPath(import.meta.url), process.argv[3]], { cwd: process.cwd(), env, stdio: 'inherit', timeout: process.argv[3] === 'record' ? 260000 : 75000 });
    } catch (error) { persistFatal(manifestFile, error, 'runtime-wrapper'); throw error; }
    finally { fs.rmSync(runRoot, { recursive: true, force: true }); }
    return;
  }

  if (command === 'init') {
    const recorder = git(process.cwd(), 'rev-parse', 'HEAD');
    requireSHA(recorder, process.env.EXPECTED_RECORDER_SHA, 'Recorder');
    requireSHA(git(source, 'rev-parse', 'HEAD'), sourceSHA, 'Goose');
    assert.equal(fs.existsSync(manifestFile), false, 'Do not mix evidence from multiple runs');
    writeJSON(manifestFile, {
      schemaVersion: 1, app: 'Goose Note', scenarioVersion: 'macos-electron-real-files-v1',
      sourceRepository: 'eachann1024/goose-notes', sourceSHA,
      recorderRepository: 'eachann1024/goose-notes', recorderSHA: recorder,
      sourceDirty: Boolean(git(source, 'status', '--porcelain', '--untracked-files=no')),
      appLockSHA256: hashFile(path.join(source, 'bun.lock')),
      runURL: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, startedAt: new Date().toISOString(),
      platform: 'GitHub standard macos-15 arm64 / packaged Electron application', viewport, locale: 'zh-CN', theme: 'ocean / light',
      runtimeNetwork: 'macOS per-process direct socket restriction; only loopback TCP and run-root Unix sockets; no claim of a Linux network namespace',
      data: 'Disposable synthetic Markdown files and isolated application profile',
      notCovered: ['Windows or Linux native behavior', 'Native folder chooser dialog', 'AI or provider calls', 'Distribution signing, notarization, global shortcuts, system screen capture', 'Full lint/unit suite; earlier failures remain unresolved'],
      status: 'initialized', errors: [], stages: {}, steps: [],
    });
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const save = () => writeJSON(manifestFile, manifest);
  if (command === 'verify-source') {
    requireSHA(git(source, 'rev-parse', 'HEAD'), sourceSHA, 'Goose after build');
    manifest.sourceDirtyAfterBuild = Boolean(git(source, 'status', '--porcelain', '--untracked-files=no'));
    manifest.appLockSHA256AfterBuild = hashFile(path.join(source, 'bun.lock'));
    save();
    assert.equal(manifest.sourceDirtyAfterBuild, false, 'Build must not modify tracked source');
    assert.equal(manifest.appLockSHA256AfterBuild, manifest.appLockSHA256, 'Dependency lock changed');
    return;
  }
  if (command === 'stage') { manifest.stages[process.argv[3]] = process.argv[4]; save(); return; }
  if (command === 'finalize') {
    const artifacts = fs.readdirSync(out).filter(n => n !== 'manifest.json' && !n.endsWith('.tmp'))
      .filter(n => fs.statSync(path.join(out, n)).isFile())
      .map(name => ({ name, bytes: fs.statSync(path.join(out, name)).size, sha256: hashFile(path.join(out, name)) }));
    summarize(manifest, process.argv[3], artifacts); save(); return;
  }
  assert.ok(['preflight', 'record'].includes(command), 'Unknown recorder command');
  if (command === 'record') {
    assert.equal(manifest.stages.preflight, 'passed', 'Sandbox preflight must pass first');
    assert.equal(manifest.stages.build, 'passed', 'Exact source build must pass first');
  }
  const requireApp = createRequire(path.join(source, 'package.json'));
  const { _electron } = requireApp('playwright');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-native-'));
  const env = isolatedEnv(profile);
  env.TMPDIR = process.env.TMPDIR;
  const executablePath = command === 'record' ? '/Applications/Goose Note.app/Contents/MacOS/Goose Note' : requireApp('electron');
  assert.equal(process.platform, 'darwin', 'Native macOS recorder only');
  assert.equal(process.env.GOOSE_RUNTIME_POLICY, crypto.createHash('sha256').update(networkPolicy).digest('hex'), 'Process-level network wrapper is required');
  let app, page, video;
  const appLog = fs.createWriteStream(path.join(out, `${command}-app.log`));
  const rendererErrors = [];
  manifest.stages[command] = 'running'; save();
  const launch = async (entry, files = [], record = false) => {
    app = await _electron.launch({ executablePath, args: [...(entry ? [entry] : []), `--user-data-dir=${profile}/profile`, '--lang=zh-CN', ...files],
      cwd: source, env, chromiumSandbox: true, timeout: 30000,
      ...(record ? { recordVideo: { dir: out, size: viewport } } : {}) });
    app.process().stdout?.pipe(appLog, { end: false });
    app.process().stderr?.pipe(appLog, { end: false });
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => rendererErrors.push(error.message));
    await page.setViewportSize(viewport);
    video = page.video();
    manifest.versions = await app.evaluate(() => ({ ...process.versions }));
    manifest.playwrightVersion = requireApp('playwright/package.json').version;
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      const p = w.webContents.getLastWebPreferences();
      return { sandboxed: p.sandbox, contextIsolated: p.contextIsolation, nodeIntegration: p.nodeIntegration, argv: process.argv };
    });
    checkSandbox(prefs); manifest.runtimePreferences = prefs;
    const identity = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, version: app.getVersion(), executable: app.getPath('exe'),
      appPath: app.getAppPath(), userData: app.getPath('userData'), sessionData: app.getPath('sessionData') }));
    assert.equal(path.resolve(identity.userData), path.resolve(profile, 'profile'), 'App userData must stay isolated');
    assert.equal(path.resolve(identity.sessionData), path.resolve(profile, 'profile'), 'Session data must stay isolated');
    if (command === 'record') {
      assert.equal(identity.packaged, true, 'Record the real packaged application');
      assert.equal(identity.version, requireApp('./package.json').version, 'App version must match the fixed source');
      assert.equal(identity.executable, executablePath);
      assert.match(identity.appPath, /Goose Note\.app\/Contents\/Resources\/app\.asar$/);
      manifest.appArchiveSHA256 = hashFile(identity.appPath);
    }
    manifest.applicationIdentity = identity; save();
    return page;
  };
  const close = async name => {
    let failure;
    if (app) {
      const current = app, child = current.process();
      try { await withDeadline(() => current.close(), 8000); }
      catch (error) { failure = error; }
      const alive = () => child.exitCode === null && child.signalCode === null;
      if (alive()) {
        child.kill('SIGTERM');
        await withDeadline(() => new Promise(resolve => child.once('exit', resolve)), 2000).catch(() => {});
      }
      if (alive()) {
        child.kill('SIGKILL');
        await withDeadline(() => new Promise(resolve => child.once('exit', resolve)), 1000).catch(() => {});
      }
      if (!alive()) app = null;
      else failure ||= new Error('Electron process did not terminate');
    }
    if (video) {
      const current = video;
      try {
        await withDeadline(() => current.saveAs(path.join(out, `${name}.webm`)), 10000);
        await withDeadline(() => current.delete(), 2000);
      } catch (error) { failure ||= error; } // Original raw file remains in the output on failure.
      video = null;
    }
    if (failure) throw failure;
  };
  const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
  const step = async (name, operation) => {
    const s = { name, startedAt: new Date().toISOString(), status: 'running' }; manifest.steps.push(s); save();
    try { await operation(); s.status = 'passed'; }
    catch (error) { s.status = 'failed'; s.error = error.message; throw error; }
    finally { s.finishedAt = new Date().toISOString(); save(); }
  };
  try {
    manifest.networkProbe = await probeNetwork();
    manifest.networkPolicySHA256 = process.env.GOOSE_RUNTIME_POLICY; save();
    if (command === 'preflight') {
      const entry = path.join(profile, 'preflight.cjs');
      fs.writeFileSync(path.join(profile, 'preload.cjs'), `const {contextBridge}=require('electron');contextBridge.exposeInMainWorld('probe',{sandboxed:process.sandboxed,contextIsolated:process.contextIsolated});`);
      fs.writeFileSync(entry, `const {app,BrowserWindow}=require('electron');const path=require('node:path');app.whenReady().then(()=>{const w=new BrowserWindow({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,'preload.cjs')}});w.loadURL('data:text/html,<title>Environment preflight</title><p>Sandbox runtime check only</p>');});`);
      await launch(entry);
      await page.waitForFunction(() => window.probe?.sandboxed === true && window.probe?.contextIsolated === true);
      manifest.preflight = { rendererProbe: await page.evaluate(() => window.probe), productUI: false };
      await close('preflight');
    } else {
      await withDeadline(async () => {
        const vault = path.join(profile, 'Goose 演示笔记'); fs.mkdirSync(path.join(vault, '项目笔记'), { recursive: true });
        const note = path.join(vault, '欢迎.md');
        const initial = '# 欢迎来到 Goose Note\n\n这是一组完全合成的演示笔记。\n\n## 今天的计划\n\n- [x] 打开本地笔记\n- [ ] 写下一个想法\n\n```javascript\nconst idea = "让思绪有个家";\n```\n\n准备记录新的灵感。\n';
        fs.writeFileSync(note, initial);
        fs.writeFileSync(path.join(vault, '项目笔记', '项目计划.md'), '# 项目计划\n\n| 工作 | 状态 |\n| --- | --- |\n| 内容整理 | 进行中 |\n| 界面检查 | 待完成 |\n');
        manifest.fixture = { beforeSHA256: hashFile(note), files: ['欢迎.md', '项目笔记/项目计划.md'] }; save();
        const entry = null; // Run the actual .app produced and installed by bun run mac.
        await launch(entry, [note], true);
        await app.context().tracing.start({ screenshots: true, snapshots: true, sources: false });
        await step('真实首次启动和海蓝主题 / First launch and ocean theme', async () => {
          await page.getByRole('main', { name: '设置引导' }).waitFor({ state: 'visible' });
          await shot('01-first-launch');
          await page.getByRole('button', { name: '浅色模式', exact: true }).click();
          await page.getByRole('radio', { name: '海蓝', exact: true }).click();
          assert.equal(await page.getByRole('radio', { name: '海蓝', exact: true }).getAttribute('aria-checked'), 'true');
          await page.getByRole('button', { name: '退出引导', exact: true }).click();
          await page.getByRole('main', { name: '设置引导' }).waitFor({ state: 'hidden' });
        });
        await step('真实文件载入和侧栏 / Open real Markdown file and folder tree', async () => {
          await page.locator('.bn-editor[contenteditable="true"]').waitFor({ state: 'visible' });
          assert.match(await page.locator('.bn-editor').innerText(), /完全合成的演示笔记/);
          assert.match(await page.locator('body').innerText(), /项目笔记/);
          await shot('02-local-folder-and-editor');
        });
        await step('编辑并核验磁盘保存 / Edit and verify the actual saved file', async () => {
          const editor = page.locator('.bn-editor[contenteditable="true"]');
          await editor.click(); await page.keyboard.press('Meta+ArrowDown'); await page.keyboard.press('Meta+ArrowRight');
          await page.keyboard.press('Enter'); await page.keyboard.type('Goose native preview: saved on real disk.');
          const until = Date.now() + 15000;
          while (!fs.readFileSync(note, 'utf8').includes('Goose native preview: saved on real disk.')) {
            if (Date.now() > until) throw new Error('Actual Markdown file was not saved');
            await new Promise(r => setTimeout(r, 100));
          }
          manifest.fixture.afterSHA256 = hashFile(note);
          assert.notEqual(manifest.fixture.afterSHA256, manifest.fixture.beforeSHA256);
          await shot('03-edited-and-saved');
        });
        await step('搜索中的真实 Markdown 预览 / Actual rendered search preview', async () => {
          await page.getByRole('button', { name: '搜索', exact: true }).click();
          const input = page.getByRole('combobox', { name: '搜索笔记', exact: true });
          await input.fill('欢迎');
          const result = page.getByRole('listbox', { name: '搜索结果' }).getByRole('option').filter({ hasText: '欢迎' });
          await result.click();
          await page.locator('.search-editor-matchbar').waitFor({ state: 'visible' });
          assert.equal(await result.getAttribute('aria-selected'), 'true');
          assert.match(await page.locator('.bn-editor').innerText(), /让思绪有个家/);
          await shot('04-markdown-search-preview');
          await page.getByRole('button', { name: '退出搜索', exact: true }).click();
        });
        await app.context().tracing.stop({ path: path.join(out, 'trace.zip') });
        await close('preview');
        await step('关闭后重新打开验证保存 / Reopen and verify persistence', async () => {
          await launch(entry, [note], true);
          await page.locator('.bn-editor').waitFor({ state: 'visible' });
          assert.match(await page.locator('.bn-editor').innerText(), /Goose native preview: saved on real disk/);
          await shot('05-reopened-persistence');
          await close('reopened');
        });
        assert.deepEqual(rendererErrors, [], 'Unexpected renderer errors');
      }, 210000);
    }
    manifest.stages[command] = 'passed';
    if (command === 'record') manifest.status = 'passed';
  } catch (error) {
    failManifest(manifest, error); manifest.stages[command] = 'failed'; console.error(error);
    if (command === 'record' && page) await withDeadline(() => shot('failure'), 5000).catch(() => {});
    process.exitCode = 1;
  } finally {
    if (app && command === 'record') await withDeadline(() => app.context().tracing.stop({ path: path.join(out, 'failure-trace.zip') }), 5000).catch(() => {});
    await close(command === 'record' ? 'partial-preview' : 'preflight').catch(error => { failManifest(manifest, error); process.exitCode = 1; });
    appLog.end(); manifest.rendererErrors = rendererErrors; save();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Observe and persist fatal startup failures without swallowing them or changing Node's exit behavior.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    try { persistFatal(path.join(path.resolve(process.env.GOOSE_OUT || path.join(os.tmpdir(), 'goose-native-out')), 'manifest.json'), error, origin); }
    catch (saveError) { console.error('Unable to preserve fatal startup failure', saveError); }
  });
  main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
}
