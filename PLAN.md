# 本地 Markdown YAML 可查看、可编辑

## Context

打开 `~/.agents/skills/pearl/SKILL.md`（与 iCloud `LinkConfig/agents/skills/pearl/SKILL.md` 同一 inode）时，顶部技能 YAML 进不了编辑器：

```yaml
---
name: pearl
description: 覆盖 PR 全链路：...
---
```

本地扫描 `parseLocalMarkdownContent` 先 `extractFrontmatter()`，YAML 进 `page.localFrontmatter`，正文才进 BlockNote；保存再 prepend。结果：用户看不到、也改不了 `name` / `description`。

已有半成品：

- `src/lib/export/markdown/parse/block.ts`：文件头 `---` → `codeBlock language=yaml-frontmatter`
- `src/lib/export/markdown/serialize.ts`：该语言写回 `---`（不要写成 \`\`\`）
- 未跟踪 `FrontmatterView.tsx` + `codeBlockSpec` 把它当 mermaid 式预览：默认不可编辑，全屏预览会抛「不支持预览」

半成品没接到扫描器；扫描器仍剥 YAML。

## Approach

全部本地 `.md`：文件头 YAML 作为可编辑 `yaml-frontmatter` 代码块出现。goose 的字体/锁定/置顶/收藏仍从同一份 YAML 读写。

- 扫描/重载：整份 markdown 进解析器，不再把 YAML 从编辑器内容里抽走。
- 保存：首块已是 YAML 时，序列化结果就是文件头；禁止再 prepend 一份隐藏 blob（否则两个 `---`）。
- 设置 UI 改 goose-*：写进首块 YAML（没有首块才回退隐藏 blob）。
- 编辑器里改 YAML：以编辑器文本为准落盘，保存时不要用过期的 page 设置把用户刚改的键盖掉。
- UI：YAML 就是普通可编辑代码块。不落地 `FrontmatterView`，撤掉 mermaid 式预览接线。
- 不改 pearl 技能正文。

## Files to modify

- `src/lib/local-folder-scanner.ts` — 整文件进 `importFromMarkdown`；goose 设置仍从原文 YAML 读；`localFrontmatter` 与首块镜像
- `src/stores/pages/actions/localFolder/write.ts` — 序列化已含 `---` 则不再 prepend
- `src/stores/pages/index.ts` — 改 goose 设置时同步首块 YAML
- `src/stores/pages/actions/pageCreate.ts` — 复制本地文件时不要「抽 body + prepend」弄出两份 YAML
- `src/native-editor/markdown.ts` — 同样把 YAML 留在块里，序列化不再二次 prepend
- `src/components/editor/blocks/code/codeBlockSpec.tsx` — `yaml-frontmatter` 当普通代码块，撤掉 visual preview
- `src/lib/export/markdown/serialize.ts` — 保留已有 `yaml-frontmatter` → `---`（已改，留下）
- `src/lib/export/markdown/parse/block.ts` — 已有文件头解析，不改逻辑
- `tests/unit/frontmatterView.test.ts` — 改成 roundtrip / 不双写断言（或新文件 `tests/unit/yamlFrontmatterRoundtrip.test.ts`）

不新增 `FrontmatterView.tsx`。未跟踪文件不提交。

## Reuse

- `markdownToJsonContent()` 已识别文件头 `---`
- `jsonContentToMarkdown()` 已把 `yaml-frontmatter` 写成 `---`
- `parseLocalFrontmatterBlob()` / `mergeLocalPageSettingsIntoFrontmatter()` 继续管 goose-* 键
- `simpleExtractText()` 已能取出 codeBlock 文本
- `CodeBlockToolbar` 已把 `yaml-frontmatter` 显示为「文档元数据 (YAML)」

抽一个小函数即可（可放 `local-frontmatter.ts`，不必新文件）：

- 首块是否 `yaml-frontmatter`
- 从 content 取出 YAML 正文
- 把 merge 后的 blob 写回首块（没有则插入；blob 空且无 goose 键则不动）

## Steps

- [x] `parseLocalMarkdownContent`：`encodeUnsupportedMarkdownForEditor` 走整份 markdown，不再只喂 body。仍 `extractFrontmatter` 填 `localFrontmatter` + goose 设置。
- [x] `saveLocalPageContent`：`blocksToMarkdown` 后若已以 `---` 开头，不要 prepend `localFrontmatter`。落盘后再从磁盘头同步 `localFrontmatter`。
- [x] `updatePage` 改 goose 设置：现有 blob merge 之后，把结果写进首块 YAML，避免设置面板改了、编辑器还是旧 YAML。
- [x] 复制本地页：优先整文件复制再 merge goose 键；内存回退时若 content 已有 YAML 块，不要再 prepend。
- [x] 原生编辑器 `parseCandidate` / `serializeCandidate`：YAML 留在 blocks，`frontmatter` 不再二次拼接。
- [x] `codeBlockSpec`：`isFrontmatter` 不进 `isVisualBlock` / `canPreview`。YAML 默认源码编辑。
- [x] 单测：pearl 风格 SKILL.md 打开能看到 `name`/`description`；改 YAML 写盘仍是单段 `---`；不会写出 \`\`\`yaml-frontmatter。

## 执行状态

- 全部 7 步完成。`bun run build` 通过（主 + quicknote + utools 产物）。
- 单测通过：`tests/unit/frontmatterView.test.ts`（3 例）+ `tests/unit/localFrontmatter.test.ts`（10 例）+ 相关 25 例全绿。
- 新增助手：`mergeSettingsIntoFrontmatterHeader`、`getContentFrontmatterBody`、`applyFrontmatterBodyToContent`（均放 `src/lib/local-frontmatter.ts`）。
- `FrontmatterView.tsx` 未落地（已在 `codeBlockSpec` 撤掉接线），保持未跟踪不提交。

### 预存在错误（本次未引入，未改动范围）

- `src/components/editor/utils/blocknote-content/normalize.ts:345`（`as PartialBlock` 属性不兼容）
- `src/components/editor/blocks/heading/headingBlockSpec.ts:75`（`collapsed` 比较类型）

两处均为 git 未修改的仓库既有错误，与 frontmatter 无关，按范围纪律不扩大到核心编辑器 heading 逻辑。

## Verification

- 单测：`tests/unit/frontmatterView.test.ts`（或改名后的 roundtrip 文件）+ 现有 `localFrontmatter.test.ts`
- `bun run build`
- 手动：打开该 `SKILL.md`，首块能看见并修改 YAML；保存后磁盘仍是 `---` 头，不是代码围栏，也不是两段 frontmatter

## Deliberate skip

- 不做 YAML 表格预览。用户要的是可编辑源码。
- 不改 pearl `SKILL.md` 正文。
- 不把 YAML 限制成仅 `SKILL.md`；所有本地 `.md` 同一条路径。
