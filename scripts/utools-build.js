import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist 目录不存在，请先执行 pnpm build');
  process.exit(1);
}

try {
  // 1. 复制 preload.js（保持 .js 扩展名以兼容 uTools）
  const preloadSrc = path.join(rootDir, 'preload/preload.cjs');
  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, path.join(distDir, 'preload.js'));
    console.log('✅ preload.js 已复制');
  } else {
    console.warn('⚠️ 未找到 preload/preload.cjs');
  }

  // 2. 创建 dist/package.json 设置 type: commonjs
  const distPackageJson = { type: 'commonjs' };
  fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(distPackageJson, null, 2));
  console.log('✅ dist/package.json 已创建（type: commonjs）');

  // 3. 复制 logo
  const logoSrc = path.join(rootDir, 'public/logo.png');
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(distDir, 'logo.png'));
    console.log('✅ logo.png 已复制');
  }

  // 4. 处理并复制 plugin.json
  const pluginConfigPath = path.join(rootDir, 'plugin.json');
  if (fs.existsSync(pluginConfigPath)) {
    const pluginConfig = JSON.parse(fs.readFileSync(pluginConfigPath, 'utf-8'));

    // 修改为生产环境路径
    pluginConfig.main = 'index.html';
    pluginConfig.preload = 'preload.js';

    // 写入到 dist
    fs.writeFileSync(path.join(distDir, 'plugin.json'), JSON.stringify(pluginConfig, null, 2));
    console.log('✅ plugin.json 已生成并配置为生产路径');
  } else {
    console.error('❌ 未找到根目录 plugin.json');
  }

} catch (e) {
  console.error('❌ 处理出错:', e);
  process.exit(1);
}
