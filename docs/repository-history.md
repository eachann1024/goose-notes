# 仓库历史整合

2026-09-30，`eachann1024/goose-notion`、`eachann1024/goose-note` 的 Git 历史整合到 `eachann1024/goose-notes`，后续开发以本仓库为主。

## 保留范围

| 来源 | 原始提交数 | 原分支入口 | 原标签与 PR 提交入口 |
| --- | ---: | --- | --- |
| goose-notes | 696 | `main` | 原有标签保持原样；旧 PR 提交另存为 `history/goose-notes/pull/1/head` 至 `history/goose-notes/pull/19/head`（标签） |
| goose-notion | 525 | `history/goose-notion/master`、`history/goose-notion/base-ui`、`history/goose-notion/editor-extraction` | `history/goose-notion/pull/1/head` 至 `history/goose-notion/pull/7/head`（标签） |
| goose-note | 6 | `history/goose-note/main` | `history/goose-note/v6`、`history/goose-note/v7` |

共 1,227 个原始提交，全部接入 `main` 的祖先提交图。原始提交对象未重写，SHA、作者、提交者、时间和当时的文件内容均保留；新增合并提交负责连接各条历史。

## 当前应用与旧版源码

三个仓库原先没有共同 Git 祖先。整合使用保留当前文件树的历史合并；`goose-notes` 当前应用代码继续作为主线，旧版功能没有在本次整合中重新移植。旧分支和标签保留完整的旧版源码，可直接在 GitHub 分支选择器中查看。

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

本次整合保留 Git 提交、分支、标签与已公布的 PR 提交引用。GitHub 的议题、PR 讨论、Release 安装包、Actions 记录和仓库设置属于独立的平台资料，没有自动迁移；两个旧仓库保留用于查询这些资料。

`goose-notion` 原为私有仓库，其历史公开已获得仓库所有者确认。旧仓库历史经 Gitleaks 扫描未发现命中项。
