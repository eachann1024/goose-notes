# 随 PR 更新的界面预览

方案参考 [Magpie UI preview](https://github.com/yetone/magpie/tree/96247a7b5d439ad45312a1578fff93e7a9a91082/.github/ui-preview)（MIT），按 Note 的 Web 界面和样例笔记适配。

## PR 生命周期

打开、更新、重新打开、转为可审查的 PR，或添加 `ui-preview` 标签时，工作流读取 PR 的真实 diff、标题、正文和 head SHA。相关源码变更自动触发；非 UI 变更不录制。Actions 手动运行也必须指定 PR 编号，结果仍更新同一 PR。

1. `detect` 使用默认分支脚本检查变更，将「正在录制」状态写入 PR 描述固定区，准备 diff 和代码上下文。
2. `inspect` 编译 PR 的 Renderer、Main、Preload，启动该 PR 的 Vite Web 界面，在独立样例文件环境获取工作区、设置、搜索、AI 面板与速记小窗的实际控件 outline。
3. `plan` 在另一个干净作业中，用 DeepSeek 对照 diff 与 outline 生成有限动作的 JSON 计划，指出 PR 描述与代码的差异，以及沙盒无法展示的部分。
4. `record` 根据计划点击、悬停、输入、滚动与截图。静态变化只截图，交互或跨页面演示生成带指针、轨迹、点击环及字幕的 H.264 MP4。失败现场交给可信规划器重新规划一次，再从独立环境重录；仍未完成的步骤明确报告。
5. `publish` 只复制校验过的 PNG/MP4，在 `ui-previews/pr-<编号>/<完整 SHA>/` 生成可信播放器。PR 描述显示截图、视频封面、播放器链接与无法展示的部分。每次替换自己的标记区，保留作者正文；过期 SHA 不回填。
6. PR 关闭或合并后删除媒体目录；重新打开会重录。媒体分支采用只保留当前文件的独立快照，避免历史积累视频。不会改动应用 Release 或更新源。

`ui-previews` 是专用产物分支，要求存在 `.goose-ui-previews` 所有权标记。Pages 配置从这个分支发布；发布器显式请求 Pages build，避免 `GITHUB_TOKEN` 推送不触发自动构建的问题。

## 隔离

`pull_request_target` 只取默认分支的工具脚本。运行 PR 代码的 inspect/record 作业仅有读权限，没有规划 key、仓库写 token 或持久 checkout 凭据。规划 key 仅传入可信的 plan/repair 步骤，不执行 PR 代码。发布作业不执行下载的代码，不发布任意 HTML、报告、trace 或源码。播放器由可信模板生成，对文本转义并设置 CSP。

规划结果须通过动作、目标长度、次数和文件名契约检查；录制禁止破坏性操作和外部请求。画面出现疑似凭据会丢弃整组媒体。预览环境不包含个人笔记或账户。

## 安装与本地验证

仓库管理员初始化专用 Pages 与 Actions Secret（key 使用进程环境，不写入文件）：

```sh
GH_REPO=owner/repo UI_PREVIEW_API_KEY=... node .github/ui-preview/setup.mjs
```

规划器默认使用 DeepSeek `deepseek-flash`；可设置 Actions vars `UI_PREVIEW_API_URL` 和 `UI_PREVIEW_MODEL`，接口须兼容 JSON Chat Completions。工具依赖使用独立、固定版本的 package-lock，PR 应用依赖仍使用 Bun。

本地流程（已有 Bun、Node、ffmpeg、Playwright Chromium；`request.json` 必须包含 diff、title、body、sha、number）：

```sh
npm ci --prefix .github/ui-preview --ignore-scripts
node .github/ui-preview/run.mjs inspect . output/pr-preview/inspection
node .github/ui-preview/plan.mjs output/pr-preview/request.json output/pr-preview/inspection/inspection.json output/pr-preview/plan.json
node .github/ui-preview/run.mjs record . output/pr-preview/media output/pr-preview/plan.json
```

`UI_PREVIEW_SKIP_BUILD=1` 仅用于已编译后的本地迭代。标准 CI 每次编译 PR。Web 预览不代替原生窗口、系统功能、真实磁盘或真实模型调用的验收；这些限制由规划器在 PR 中说明。
