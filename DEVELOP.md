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

`build` 编译两个 renderer、Electron main/preload，并准备 `dist-electron/app-pack`。`typecheck`、`lint` 和 `build` 用于静态排错或打包，不是产品验收标准，也不代替界面操作。

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

普通页面、外观或局部交互，直接在浏览器中从正常入口快速操作受影响部分。复杂流程由读取 `use-browser` 的子代理通过真实界面走到最终结果，记录实际动作和可见结果。

必须使用电脑时，读取 `use-compute`，仅操作受影响的原生控件及必要系统交互；需要新安装包才运行 `bun run mac`。浏览器没有 Electron 宿主桥，不能验证真实磁盘保存、系统剪贴板或全局快捷键，未覆盖部分须如实说明。

不编写、不运行 TDD、ERE、单元或 E2E 用例，不建设测试桥、fixture、自动断言录制或覆盖率门槛。一次性原型、截图和实操记录保存在仓库外，不进入源码提交。生产构建、正式视频与安装包按实际用途归档，不当成无用缓存整目录删除。

手写实现按独立职责拆到不超过 300 行，主要模块约 200–300 行，入口、类型和纯工具可以更短。生成声明通过生成步骤分片；持久化格式、迁移、恢复、路径保护和事件顺序不能因拆分而改变。

## 项目状态

当前代码采用 MIT；第三方及历史许可例外见 THIRD-PARTY-NOTICES.txt。源码获取与构建步骤见 SOURCE-CODE.md。参阅 [LICENSE](LICENSE)、[CONTRIBUTING.md](CONTRIBUTING.md) 与 [SECURITY.md](SECURITY.md)。
