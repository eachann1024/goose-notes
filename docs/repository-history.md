# 仓库历史整合

2026-09-30，`eachann1024/goose-notion`、`eachann1024/goose-note` 的 Git 历史整合到 `eachann1024/goose-notes`，后续开发以本仓库为主。

## 保留范围

| 来源 | 原始提交数 | 原分支入口 | 原标签与 PR 提交入口 |
| --- | ---: | --- | --- |
| goose-notes | 696 | `main` | 原有标签保持原样；旧 PR 提交另存为 `history/goose-notes/pull/1/head` 至 `history/goose-notes/pull/19/head`（标签） |
| goose-notion | 525 | `history/goose-notion/master`、`history/goose-notion/base-ui`、`history/goose-notion/editor-extraction` | `history/goose-notion/pull/1/head` 至 `history/goose-notion/pull/7/head`（标签） |
| goose-note | 6 | `history/goose-note/main` | `history/goose-note/v6`、`history/goose-note/v7` |

共 1,227 个原始提交，整合时全部接入当时 `main` 的祖先提交图。该完整主线现保存在 `history/main-before-contributor-scope-20260930`；原始提交对象未重写，SHA、作者、提交者、时间和当时的文件内容均保留。

## 当前主线与历史归档

当前主线使用独立的提交链，包含历史基线导入、两条协作者的真实修复提交重放，以及已发布源码快照同步。导入与同步提交记录的是迁移操作，不将归档中的原始工作重新署名。重放提交保留原作者、作者时间和完整补丁，并以 `Original-Commit` 标明原提交。

历史归档分支保留迁移前的完整开发过程。当前主线不再将其作为祖先；旧标签、旧 PR 提交入口和原始 SHA 继续指向原有历史。除本历史说明外，迁移后的文件快照与迁移前的 `ac241bb92abdec9916464d1107e98f0850fe2760` 完全一致。

## 当前应用与旧版源码

三个仓库原先没有共同 Git 祖先。当时的整合使用保留当前文件树的历史合并；`goose-notes` 当前应用代码继续作为主线，旧版功能没有在该次整合中重新移植。旧分支和标签保留完整的旧版源码，可直接在 GitHub 分支选择器中查看。

整合前的当前代码基准：`1a13c8d226fbd6e5599a2f962be44fac4fa9d4b2`。新增历史索引文档之外，整合没有改变应用文件。

查看完整提交图：

```sh
git log --graph --oneline --all
```

查看旧版文件：

```sh
git show history/goose-notion/master:package.json
git show history/goose-note/v7:README.md
```

## GitHub 资料

本次整合保留 Git 提交、分支、标签与已公布的 PR 提交引用。2026-09-30，按仓库所有者要求，`eachann1024/goose-notion` 和 `eachann1024/goose-note` 已删除；全部原始 Git 历史仍保存在本仓库，另有本地 Git 镜像与 bundle 备份。GitHub 的议题、PR 讨论、Release 安装包、Actions 记录和仓库设置属于独立的平台资料，没有迁移到本仓库。

`goose-notion` 原为私有仓库，其历史公开已获得仓库所有者确认。旧仓库历史经 Gitleaks 扫描未发现命中项。
