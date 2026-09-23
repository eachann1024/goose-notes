#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [platform, arch] = process.argv.slice(2);
const targets = { win: ['nsis'], mac: ['dmg', 'zip'], linux: ['AppImage', 'deb', 'rpm', 'pacman'] };
const host = { win: 'win32', mac: 'darwin', linux: 'linux' };
if (process.platform !== host[platform] || !['x64', 'arm64'].includes(arch) || (platform !== 'mac' && arch !== 'x64')) {
  throw new Error('Expected native host and win x64, mac arm64/x64, or linux x64');
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const pack = resolve(root, 'dist-electron/app-pack');
execFileSync(process.execPath, [
  resolve(root, 'node_modules/electron-builder/out/cli/cli.js'),
  `--${platform}`, ...targets[platform], `--${arch}`, '--publish', 'never',
], { cwd: pack, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });

const output = resolve(root, 'dist-desktop/ci');
mkdirSync(output, { recursive: true });
const files = readdirSync(resolve(root, 'dist-electron/packaged')).filter(name =>
  /\.(exe|dmg|zip|AppImage|deb|rpm|pacman)$/.test(name));
for (const ext of { win: ['exe'], mac: ['dmg', 'zip'], linux: ['AppImage', 'deb', 'rpm', 'pacman'] }[platform]) {
  if (!files.some(name => name.endsWith(`.${ext}`))) throw new Error(`Missing ${ext} installer`);
}
for (const file of files) {
  const from = resolve(root, 'dist-electron/packaged', file);
  if (!statSync(from).isFile()) throw new Error(`Expected installer file: ${file}`);
  cpSync(from, resolve(output, file));
}
for (const file of ['LICENSE', 'THIRD-PARTY-NOTICES.txt', 'SOURCE-CODE.md', 'BUILD-ARTIFACTS.md']) {
  cpSync(resolve(root, file), resolve(output, file));
}
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
writeFileSync(resolve(output, 'BUILD.json'), JSON.stringify({
  commit, version: pkg.version, platform, arch,
  signed: platform === 'mac' && Boolean(process.env.CSC_LINK),
  notarized: platform === 'mac' && Boolean(process.env.CSC_LINK && process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID),
  run: process.env.GITHUB_RUN_ID || null,
  sourceArtifact: `source-${commit}`, files,
}, null, 2) + '\n');
writeFileSync(resolve(output, 'SHA256SUMS.txt'), readdirSync(output).filter(name => name !== 'SHA256SUMS.txt').sort().map(name =>
  `${createHash('sha256').update(readFileSync(resolve(output, name))).digest('hex')}  ${name}`
).join('\n') + '\n');
console.log(`Verified ${files.length} installers: ${output}`);
