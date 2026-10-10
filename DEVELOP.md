# Goose Note 开发说明

本地优先的 Electron Markdown 笔记应用，主窗口与独立速记小窗共享 React、TypeScript、Vite 和 BlockNote 编辑器。

## 开发与检查

使用 `package.json` 指定的 Bun 版本；Node.js 需要 20 或以上。

```bash
bun install --frozen-lockfile
bun run dev          # 浏览器开发，端口 6001
bun run typecheck
bun run lint
bun run build
```

`build` 编译两个 renderer、Electron main/preload，并准备 `dist-electron/app-pack`；它不包含 TypeScript 类型检查，须单独运行 `typecheck`。浏览器验证不能代替 Electron 窗口、文件系统与全局快捷键验收。

## 构建与分发

```bash
bun run mac          # macOS 应用
bun run win          # Windows NSIS，跨平台构建要求以构建脚本为准
bun run linux        # Linux 包
bun run build:debug  # 保留调试信息
```

跨平台单入口脚本（参考 1Panel build.py 思路，三平台通用）：

```bash
python3 build.py all                               # 编译 → 打包 → 安装 → 启动
python3 build.py kill                              # 强杀运行中的 Goose Note（安装版与开发实例）
python3 build.py build --no-install                # 跳过 bun install 只编译
python3 build.py package --linux-targets AppImage,deb  # Linux 指定打包目标（缺 libarchive-tools、无法打 pacman 时）
python3 build.py install / start / status / clean / release
```

`package` 前会自动强杀旧实例（SingletonLock 与已挂载 AppImage 会阻塞覆盖）；本地打包默认注入 npmmirror 工具链镜像，已设置的 `ELECTRON_MIRROR` 等环境变量优先。`release` 读取 `artifacts/`（CI 汇总的完整产物），需 gh 已登录。

- `dist-electron/renderer`：主窗口 `index.html` 与速记 `quicknote.html`。
- `dist-electron/main`、`dist-electron/preload`：Electron 编译结果。
- `dist-electron/app-pack`：打包输入目录。
- `dist-electron/packaged`：桌面构建中间产物。
- `dist-desktop`：收集后的可分发应用与安装包。
- `GOOSE_BUILD_TARGET=quicknote bunx vite build` 等精简构建路径以 `vite.config.ts` 的当前配置为准；正式桌面构建包含两个 renderer。

修改后重新构建即可生成新包，无需在外部插件管理器中加载。macOS 未签名应用通过 zip 分发；接收方仅对确认可信的应用处理系统隔离提示。

## 数据与验收

当前产品以挂载本地 Markdown 文件夹为记事本；卸载挂载不删除目录。保留旧数据迁移、导出、备份与回收机制，不能把暂时无调用的迁移代码或用户笔记当作缓存清理。

涉及桌面行为时，使用开发模式或构建应用验证相关路径：启动、打开文件夹、文件读写、主窗与速记切换、剪贴板、附件和外链。修改编辑器时验证标题保护、选择、复制粘贴及受影响导出。涉及持久化时验证失败反馈和数据恢复；成功自动保存保持安静。

测试产物写入 `output/`、`test-results/`；一次性原型、截图与验收记录不进入源码提交。生产构建和安装包不等同于可删除缓存。

## 项目状态

当前代码采用 MIT；第三方及历史许可例外见 THIRD-PARTY-NOTICES.txt。源码获取与构建步骤见 SOURCE-CODE.md。参阅 [LICENSE](LICENSE)、[CONTRIBUTING.md](CONTRIBUTING.md) 与 [SECURITY.md](SECURITY.md)。
