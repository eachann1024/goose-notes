// 公开仓只放页面和安装包，源码留在私有仓。
// Public repository distribution script: only README/assets/installers are published; source stays in private repo.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INSTALLER_EXTENSIONS = new Set(['.exe', '.dmg', '.zip', '.AppImage', '.deb', '.rpm', '.pacman']);

export function transformReadme(content, publicRepo = 'eachann1024/goose-note-app') {
  let out = content;
  // 1. Point releases to public repository latest release
  out = out.replace(
    /https:\/\/github\.com\/eachann1024\/goose-notes\/releases(?:\/latest)?/g,
    `https://github.com/${publicRepo}/releases/latest`,
  );
  // 2. Remove DEVELOP.md and SECURITY.md links from header
  out = out.replace(/\s*·\s*<a href="DEVELOP\.md">开发文档<\/a>/g, '');
  out = out.replace(/<a href="DEVELOP\.md">开发文档<\/a>\s*·\s*/g, '');
  out = out.replace(/\s*·\s*<a href="SECURITY\.md">安全说明<\/a>/g, '');
  out = out.replace(/<a href="SECURITY\.md">安全说明<\/a>\s*·\s*/g, '');
  // 3. Remove source dev instructions and DEVELOP.md link in details
  out = out.replace(
    /<details>[\s\S]*?<summary>从源码运行与平台说明<\/summary>[\s\S]*?<\/details>/g,
    '<details>\n<summary>平台说明</summary>\n\n采用 Electron、React、TypeScript 和 BlockNote。安装包支持 macOS、Windows 和 Linux，各平台安装包可在 Releases 下载。\n\n</details>',
  );
  out = out.replace(/\[开发文档\]\(DEVELOP\.md\)/g, '');
  // 4. Update license details to remove missing SOURCE-CODE.md / THIRD-PARTY-NOTICES.txt links
  out = out.replace(
    /详见 \[LICENSE\]\(LICENSE\)[^。]*?。/g,
    '详见 [LICENSE](LICENSE)。',
  );
  // 5. Remove private repo contributor link and scrub residual private repo URLs
  out = out.replace(/\s*；?\s*\[查看当前贡献统计\]\(https:\/\/github\.com\/eachann1024\/goose-notes\/graphs\/contributors\)/g, '');
  out = out.replace(/https:\/\/github\.com\/eachann1024\/goose-notes[^\s)"]*/g, `https://github.com/${publicRepo}`);
  return out;
}

export function findInstallers(searchDirs) {
  const dirs = Array.isArray(searchDirs) ? searchDirs : [searchDirs];
  const results = [];
  const visited = new Set();

  function scan(current) {
    if (!existsSync(current)) return;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        const isSourceArchive = entry.name.endsWith('.tar.gz') || entry.name.includes('source-');
        const isMetadata = entry.name === 'SHA256SUMS.txt' || entry.name === 'COMMIT.txt' || entry.name === 'BUILD.json';
        if (INSTALLER_EXTENSIONS.has(ext) && !isSourceArchive && !isMetadata) {
          const safeName = entry.name.replace(/ /g, '.');
          if (!visited.has(safeName)) {
            visited.add(safeName);
            results.push({ name: safeName, originalPath: fullPath, ext });
          }
        }
      }
    }
  }

  for (const dir of dirs) {
    scan(dir);
  }
  return results;
}

export function checkPlatformCoverage(installers) {
  const hasWin = installers.some(f => f.ext === '.exe');
  const hasMac = installers.some(f => f.ext === '.dmg');
  const hasLinux = installers.some(f => f.ext === '.AppImage' || f.ext === '.deb' || f.ext === '.rpm' || f.ext === '.pacman');
  const missing = [];
  if (!hasWin) missing.push('Windows (.exe)');
  if (!hasMac) missing.push('macOS (.dmg)');
  if (!hasLinux) missing.push('Linux (.AppImage/.deb/.rpm/.pacman)');
  if (missing.length > 0) {
    throw new Error(`Missing installer platforms: ${missing.join(', ')}`);
  }
}

export function runGit(args, cwd, token) {
  try {
    return execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (err) {
    const raw = [err.stderr, err.stdout, err.message].filter(Boolean).map(String).join('\n');
    let safeMsg = token ? raw.replaceAll(token, '***').replaceAll(encodeURIComponent(token), '***') : raw;
    safeMsg = safeMsg.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
    throw new Error(`git ${args[0]} failed: ${safeMsg}`);
  }
}

export function cloneOrInitRepo(cloneDir, authUrl, token, baseDir = ROOT) {
  try {
    runGit(['clone', authUrl, cloneDir], baseDir, token);
  } catch {
    rmSync(cloneDir, { recursive: true, force: true });
    mkdirSync(cloneDir, { recursive: true });
    runGit(['init'], cloneDir, token);
    runGit(['remote', 'add', 'origin', authUrl], cloneDir, token);
  }
  runGit(['checkout', '-B', 'main'], cloneDir, token);
}

export function runSelfTest() {
  console.log('Running self-check for publish-public-app...');
  const sampleReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const transformed = transformReadme(sampleReadme, 'eachann1024/goose-note-app');

  assert.ok(transformed.includes('eachann1024/goose-note-app/releases/latest'), 'Must point to public releases/latest');
  assert.ok(!transformed.includes('goose-notes'), 'Must not link to private repo');
  assert.ok(!transformed.includes('graphs/contributors'), 'Must remove private contributor graph link');
  assert.ok(!transformed.includes('DEVELOP.md'), 'Must remove DEVELOP.md link');
  assert.ok(!transformed.includes('SECURITY.md'), 'Must remove SECURITY.md link');
  assert.ok(!transformed.includes('SOURCE-CODE.md'), 'Must not expose SOURCE-CODE.md link');
  assert.ok(!transformed.includes('THIRD-PARTY-NOTICES.txt'), 'Must remove THIRD-PARTY-NOTICES.txt link');
  assert.ok(transformed.includes('[LICENSE](LICENSE)'), 'Must retain LICENSE reference');
  assert.ok(transformed.includes('docs/showcase/01-writing-ai.png'), 'Must keep relative image paths');
  assert.ok(transformed.includes('https://github.com/eachann1024/goose-mark'), 'Must retain series links');

  // Verify installer scanner & exclusions
  const testTmp = mkdtempSync(join(tmpdir(), 'installer-test-'));
  try {
    mkdirSync(join(testTmp, 'win'));
    mkdirSync(join(testTmp, 'mac'));
    mkdirSync(join(testTmp, 'linux'));
    mkdirSync(join(testTmp, 'source'));

    writeFileSync(join(testTmp, 'win', 'Goose Note Setup 9.0.1.exe'), 'exe');
    writeFileSync(join(testTmp, 'win', 'BUILD.json'), '{}');
    writeFileSync(join(testTmp, 'mac', 'Goose Note-9.0.1-arm64.dmg'), 'dmg');
    writeFileSync(join(testTmp, 'mac', 'Goose Note-9.0.1-arm64-mac.zip'), 'zip');
    writeFileSync(join(testTmp, 'linux', 'Goose-Note-9.0.1.AppImage'), 'appimage');
    writeFileSync(join(testTmp, 'linux', 'goose-note-app_9.0.1_amd64.deb'), 'deb');
    writeFileSync(join(testTmp, 'source', 'goose-note-source-1234567.tar.gz'), 'tar');
    writeFileSync(join(testTmp, 'source', 'SHA256SUMS.txt'), 'sums');
    writeFileSync(join(testTmp, 'source', 'COMMIT.txt'), 'commit');

    const found = findInstallers(testTmp);
    const names = found.map(f => f.name);

    assert.ok(names.includes('Goose.Note.Setup.9.0.1.exe'), 'Must include .exe');
    assert.ok(names.includes('Goose.Note-9.0.1-arm64.dmg'), 'Must include .dmg');
    assert.ok(names.includes('Goose-Note-9.0.1.AppImage'), 'Must include .AppImage');
    assert.ok(!names.some(n => n.endsWith('.tar.gz')), 'Must NOT include .tar.gz source archive');
    assert.ok(!names.some(n => n.includes('source')), 'Must NOT include source assets');
    assert.ok(!names.includes('SHA256SUMS.txt'), 'Must NOT include old SHA256SUMS.txt');
    assert.ok(!names.includes('BUILD.json'), 'Must NOT include BUILD.json');

    checkPlatformCoverage(found);

    // Missing platform check
    const withoutWin = found.filter(f => f.ext !== '.exe');
    assert.throws(() => checkPlatformCoverage(withoutWin), /Missing installer platforms: Windows/);
  } finally {
    rmSync(testTmp, { recursive: true, force: true });
  }

  // Verify empty repo fallback & token masking
  const emptyRepoTmp = mkdtempSync(join(tmpdir(), 'empty-repo-test-'));
  try {
    const bareRemote = join(emptyRepoTmp, 'remote.git');
    runGit(['init', '--bare', bareRemote]);

    const workTree = join(emptyRepoTmp, 'work');
    mkdirSync(workTree, { recursive: true });

    cloneOrInitRepo(workTree, bareRemote, 'dummy-token', emptyRepoTmp);
    writeFileSync(join(workTree, 'README.md'), '# Test Public Repo');
    runGit(['config', 'user.name', 'test-bot'], workTree);
    runGit(['config', 'user.email', 'bot@example.com'], workTree);
    runGit(['add', '-A'], workTree);
    runGit(['commit', '-m', 'Initial public commit'], workTree);
    runGit(['push', '-u', 'origin', 'main'], workTree);

    const branches = runGit(['branch', '-a'], workTree);
    assert.ok(branches.includes('main'), 'Must switch to and push main branch');

    const secret = 'ghp_super_secret_test_token_98765';
    assert.throws(
      () => runGit(['clone', `https://x-access-token:${secret}@localhost:9/invalid.git`, join(emptyRepoTmp, 'fail')], emptyRepoTmp, secret),
      (err) => {
        assert.ok(!err.message.includes(secret), 'Error message must not contain secret token');
        assert.ok(err.message.includes('***'), 'Error message must contain masked replacement');
        return true;
      },
    );
  } finally {
    rmSync(emptyRepoTmp, { recursive: true, force: true });
  }

  console.log('Self-check passed: README rewrite, installer filtering, platform checks, and empty repo fallback verified.');
}

async function main() {
  if (process.argv.includes('--test') || process.argv.includes('--self-test') || process.env.NODE_TEST_CONTEXT) {
    runSelfTest();
    return;
  }

  const token = process.env.PUBLIC_APP_TOKEN;
  if (!token) {
    console.error('Error: PUBLIC_APP_TOKEN environment variable is required to publish to public repository.');
    process.exit(1);
  }

  const publicRepo = process.env.PUBLIC_APP_REPO || 'eachann1024/goose-note-app';
  const sha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sha7 = sha.slice(0, 7);
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;

  console.log(`Publishing release v${version}-${sha7} to ${publicRepo}...`);

  // 1. Sync public repository files
  const cloneDir = mkdtempSync(join(tmpdir(), 'goose-public-repo-'));
  try {
    const authUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${publicRepo}.git`;
    cloneOrInitRepo(cloneDir, authUrl, token);

    // Write updated README.md
    const rawReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const transformedReadme = transformReadme(rawReadme, publicRepo);
    writeFileSync(join(cloneDir, 'README.md'), transformedReadme, 'utf8');

    // Copy LICENSE
    copyFileSync(join(ROOT, 'LICENSE'), join(cloneDir, 'LICENSE'));

    // Copy logo and showcase images
    mkdirSync(join(cloneDir, 'public'), { recursive: true });
    if (existsSync(join(ROOT, 'public/logo.png'))) {
      copyFileSync(join(ROOT, 'public/logo.png'), join(cloneDir, 'public/logo.png'));
    }

    mkdirSync(join(cloneDir, 'docs/showcase'), { recursive: true });
    for (const img of ['01-writing-ai.png', '02-code-and-diagram-user.png', 'cover.png']) {
      const srcPath = join(ROOT, 'docs/showcase', img);
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, join(cloneDir, 'docs/showcase', img));
      }
    }

    const status = runGit(['status', '--porcelain'], cloneDir, token).trim();
    if (status) {
      runGit(['config', 'user.name', 'github-actions[bot]'], cloneDir, token);
      runGit(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], cloneDir, token);
      runGit(['add', '-A'], cloneDir, token);
      runGit(['commit', '-m', `Update download page for ${sha7}`], cloneDir, token);
      runGit(['push', '-u', 'origin', 'main'], cloneDir, token);
      console.log(`Synced README and assets to ${publicRepo} main branch.`);
    } else {
      console.log('No file changes in public repository download page, skipping commit.');
    }
  } finally {
    rmSync(cloneDir, { recursive: true, force: true });
  }

  // 2. Scan and validate installers
  const searchCandidates = [
    join(ROOT, 'artifacts'),
    join(ROOT, 'release-assets'),
    join(ROOT, 'dist-desktop/ci'),
  ].filter(p => existsSync(p));

  const installers = findInstallers(searchCandidates);
  checkPlatformCoverage(installers);

  // 3. Stage installers and compute SHA256SUMS.txt
  const stageDir = mkdtempSync(join(tmpdir(), 'goose-public-assets-'));
  try {
    const stagedPaths = [];
    for (const item of installers) {
      const targetPath = join(stageDir, item.name);
      copyFileSync(item.originalPath, targetPath);
      stagedPaths.push(targetPath);
    }

    const checksumLines = stagedPaths.map(filePath => {
      const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
      return `${hash}  ${basename(filePath)}`;
    }).sort().join('\n') + '\n';

    const sumsPath = join(stageDir, 'SHA256SUMS.txt');
    writeFileSync(sumsPath, checksumLines, 'utf8');
    stagedPaths.push(sumsPath);

    // 4. Create public Release
    const tag = `v${version}-${sha7}`;
    const title = `Goose Note ${version}`;
    // ponytail: unsigned/unnotarized release assets; add codesign/notarization when signing certificates are configured.
    const notes = [
      `正式版本 ${version}（构建对应提交：${sha}）`,
      '',
      '平台支持：',
      '- Windows x64：.exe 安装包',
      '- macOS Apple Silicon：arm64.dmg / .zip',
      '- macOS Intel：dmg / .zip',
      '- Linux x64：AppImage / deb / rpm / pacman',
      '',
      '本版本未签名，macOS 未公证。',
      '各平台安装包与校验值见随附 Release Assets 和 SHA256SUMS.txt。',
    ].join('\n');

    const ghEnv = { ...process.env, GH_TOKEN: token, GH_REPO: publicRepo };

    let releaseExists = false;
    try {
      execFileSync('gh', ['release', 'view', tag], { env: ghEnv, stdio: 'ignore' });
      releaseExists = true;
    } catch {
      releaseExists = false;
    }
    if (releaseExists) {
      console.log(`Release ${tag} already exists in ${publicRepo}, deleting...`);
      execFileSync('gh', ['release', 'delete', tag, '--yes'], { env: ghEnv, stdio: 'inherit' });
    }

    console.log(`Creating draft release ${tag} in ${publicRepo}...`);
    execFileSync('gh', [
      'release', 'create', tag,
      '--title', title,
      '--notes', notes,
      '--draft',
    ], { env: ghEnv, stdio: 'inherit' });

    console.log(`Uploading ${stagedPaths.length} assets to release ${tag}...`);
    execFileSync('gh', [
      'release', 'upload', tag,
      '--clobber',
      ...stagedPaths,
    ], { env: ghEnv, stdio: 'inherit' });

    console.log(`Publishing release ${tag} (undraft)...`);
    execFileSync('gh', [
      'release', 'edit', tag,
      '--draft=false',
      '--latest',
    ], { env: ghEnv, stdio: 'inherit' });

    console.log(`Successfully published ${tag} to ${publicRepo}!`);
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
