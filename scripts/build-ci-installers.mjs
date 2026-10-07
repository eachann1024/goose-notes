#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Usage: build-ci-installers.mjs <platform> <arch> [--stage=all|unpacked|installer|collect]
// "all" (default) builds and collects in one go. Windows signing (SignPath) splits the build so the
// workflow can sign between stages: unpacked → sign app exe → installer (prepackaged) → sign → collect.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [platform, arch] = process.argv.slice(2);
const stage = process.argv.find(arg => arg.startsWith('--stage='))?.slice('--stage='.length) ?? 'all';
// mac ZIPs feed Squirrel.Mac auto-update for signed builds; publish-release.mjs drops them otherwise.
const targets = { win: ['nsis'], mac: ['dmg', 'zip'], linux: ['AppImage', 'deb', 'pacman'] };
const host = { win: 'win32', mac: 'darwin', linux: 'linux' };
if (process.platform !== host[platform] || !['x64', 'arm64'].includes(arch) || (platform === 'linux' && arch !== 'x64')) {
  throw new Error('Expected native host and win x64/arm64, mac arm64/x64, or linux x64');
}
if (!['all', 'unpacked', 'installer', 'collect'].includes(stage) || (stage !== 'all' && platform !== 'win')) {
  throw new Error(`Unsupported stage ${stage} for ${platform}`);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const pack = resolve(root, 'dist-electron/app-pack');
const packaged = resolve(root, 'dist-electron/packaged');
const signDir = resolve(root, 'dist-signpath');
const unpacked = resolve(packaged, platform === 'win' ? (arch === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked') : 'linux-unpacked');
const appExe = 'Goose Note.exe';

function builder(...args) {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/electron-builder/out/cli/cli.js'), ...args, `--${arch}`, '--publish', 'never',
  ], { cwd: pack, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
}

function installerFiles() {
  return readdirSync(packaged).filter(name => /\.(exe|dmg|zip|AppImage|deb|pacman)$/.test(name));
}

function copyInto(fromDir, toDir, name) {
  const from = resolve(fromDir, name);
  if (!existsSync(from)) throw new Error(`Missing signed file: ${from}`);
  cpSync(from, resolve(toDir, name));
}

function assertAuthenticode(file) {
  const status = execFileSync('powershell', ['-NoProfile', '-Command',
    `(Get-AuthenticodeSignature -LiteralPath '${file.replaceAll("'", "''")}').Status`], { encoding: 'utf8' }).trim();
  if (status !== 'Valid') throw new Error(`Authenticode signature of ${file} is ${status}`);
}

if (stage === 'unpacked') {
  builder('--win', 'dir');
  rmSync(resolve(signDir, 'app'), { recursive: true, force: true });
  mkdirSync(resolve(signDir, 'app'), { recursive: true });
  cpSync(resolve(unpacked, appExe), resolve(signDir, 'app', appExe));
  console.log(`Unsigned ${appExe} staged for SignPath: ${resolve(signDir, 'app')}`);
  process.exit(0);
}
if (stage === 'installer') {
  copyInto(resolve(signDir, 'app-signed'), unpacked, appExe);
  assertAuthenticode(resolve(unpacked, appExe));
  builder('--win', 'nsis', '--prepackaged', unpacked);
  rmSync(resolve(signDir, 'installer'), { recursive: true, force: true });
  mkdirSync(resolve(signDir, 'installer'), { recursive: true });
  for (const file of installerFiles()) cpSync(resolve(packaged, file), resolve(signDir, 'installer', file));
  console.log(`Unsigned installer staged for SignPath: ${resolve(signDir, 'installer')}`);
  process.exit(0);
}
if (stage === 'all') builder(`--${platform}`, ...targets[platform]);
const signed = stage === 'collect';
if (signed) {
  for (const file of installerFiles()) {
    copyInto(resolve(signDir, 'installer-signed'), packaged, file);
    assertAuthenticode(resolve(packaged, file));
  }
  assertAuthenticode(resolve(unpacked, appExe));
}

// Verify the runtime icon inside the actual packaged app, not only the input directory.
const builderRequire = createRequire(resolve(root, 'node_modules/electron-builder/package.json'));
const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'));
const { extractFile } = appBuilderRequire('@electron/asar');
const appAsar = platform === 'mac'
  ? resolve(packaged, arch === 'arm64' ? 'mac-arm64' : 'mac', 'Goose Note.app/Contents/Resources/app.asar')
  : resolve(unpacked, 'resources/app.asar');
if (!extractFile(appAsar, 'icon.png').equals(readFileSync(resolve(root, 'electron/icons/icon.png')))) {
  throw new Error('Packaged BrowserWindow icon does not match the application icon');
}
console.log('Verified packaged BrowserWindow icon in app.asar');

const output = resolve(root, 'dist-desktop/ci');
mkdirSync(output, { recursive: true });
const files = installerFiles();
for (const ext of targets[platform].map(target => target === 'nsis' ? 'exe' : target)) {
  if (!files.some(name => name.endsWith(`.${ext}`))) throw new Error(`Missing ${ext} installer`);
}
for (const file of files) {
  const from = resolve(packaged, file);
  if (!statSync(from).isFile()) throw new Error(`Expected installer file: ${file}`);
  cpSync(from, resolve(output, file));
}
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
// Hashes are computed here, after signing, so SHA256SUMS and the update feed describe the signed files.
writeFileSync(resolve(output, 'BUILD.json'), JSON.stringify({
  commit, version: pkg.version, platform, arch,
  signed: platform === 'mac' ? Boolean(process.env.CSC_LINK) : signed,
  notarized: platform === 'mac' && Boolean(process.env.CSC_LINK && process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID),
  run: process.env.GITHUB_RUN_ID || null,
  sourceArtifact: `source-${commit}`, files,
}, null, 2) + '\n');
writeFileSync(resolve(output, 'SHA256SUMS.txt'), readdirSync(output).filter(name => name !== 'SHA256SUMS.txt').sort().map(name =>
  `${createHash('sha256').update(readFileSync(resolve(output, name))).digest('hex')}  ${name}`
).join('\n') + '\n');
console.log(`Verified ${files.length} installers: ${output}`);
