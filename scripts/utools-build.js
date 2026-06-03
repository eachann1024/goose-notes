import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

if (!fs.existsSync(distDir)) {
  console.error('dist 目录不存在');
  process.exit(1);
}

try {
  const preloadSrc = path.join(rootDir, 'preload/preload.cjs');
  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, path.join(distDir, 'preload.js'));
  }

  const preloadHelperSrc = path.join(rootDir, 'preload/mcp-tools.cjs');
  if (fs.existsSync(preloadHelperSrc)) {
    fs.copyFileSync(preloadHelperSrc, path.join(distDir, 'mcp-tools.cjs'));
  }

  fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));

  const logoSrc = path.join(rootDir, 'public/logo.png');
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(distDir, 'logo.png'));
  }

  const pluginConfigPath = path.join(rootDir, 'plugin.json');
  if (fs.existsSync(pluginConfigPath)) {
    const pluginConfig = JSON.parse(fs.readFileSync(pluginConfigPath, 'utf-8'));
    pluginConfig.main = 'index.html';
    pluginConfig.preload = 'preload.js';
    fs.writeFileSync(path.join(distDir, 'plugin.json'), JSON.stringify(pluginConfig, null, 2));
  } else {
    console.error('未找到 plugin.json');
    process.exit(1);
  }

  function removeMapFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removeMapFiles(full);
      } else if (entry.name.endsWith('.map')) {
        fs.unlinkSync(full);
      }
    }
  }
  // 调试构建 (GOOSE_DEBUG=1) 保留 .map，供 uTools 开发者工具(Chromium DevTools) 还原 src/；
  // 正式构建删除 .map：vite sourcemap='hidden' 已让 JS 不含 sourceMappingURL，删 .map 既不外泄也不增体积。
  if (process.env.GOOSE_DEBUG === '1') {
    console.log('[utools-build] GOOSE_DEBUG=1：保留 sourcemap (.map) 文件');
  } else {
    removeMapFiles(distDir);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
