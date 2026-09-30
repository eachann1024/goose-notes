import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [mode, sourceArg = '.', outArg = 'output/ui-preview', planArg] = process.argv.slice(2);
if (!['inspect', 'record'].includes(mode) || (mode === 'record' && !planArg)) throw new Error('run.mjs inspect|record <PR source> <out> [plan.json]');
const source = path.resolve(sourceArg), out = path.resolve(outArg);
const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-pr-preview-home-'));
fs.mkdirSync(out, { recursive: true });
// Never forward the parent planner key, GitHub token or personal config to PR code.
const env = Object.fromEntries(['PATH', 'LANG', 'CI', 'NODE_OPTIONS'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { HOME: home, XDG_CONFIG_HOME: path.join(home,'config'), XDG_CACHE_HOME: path.join(home,'cache'), ELECTRON_SKIP_BINARY_DOWNLOAD: '1' });
let web;
try {
  if (process.env.UI_PREVIEW_SKIP_BUILD !== '1') {
    const build = spawnSync('bun', ['run', 'build:electron'], { cwd: source, env, stdio: 'inherit' });
    if (build.status !== 0) throw new Error('PR application build failed');
  }
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  web = spawn('bun', ['run', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: source, env, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (web.exitCode !== null) throw new Error('PR renderer exited before startup');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('PR renderer startup timed out');
  const result = spawn('node', [path.join(here, 'browser.mjs'), mode, url, out, ...(planArg ? [path.resolve(planArg)] : [])], {
    env: { ...env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright') }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => { result.on('error', reject); result.on('exit', (code, signal) => resolve(code ?? 1)); });
  process.exitCode = code;
} finally {
  if (web?.pid) { try { process.kill(process.platform === 'win32' ? web.pid : -web.pid, 'SIGTERM'); } catch {} }
  fs.rmSync(home, { recursive: true, force: true });
}
