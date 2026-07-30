# MCP 工具

鹅的笔记通过 uTools 插件清单中的 `tools` 暴露只读 MCP 工具。安装构建产物后，支持 uTools MCP 的客户端会自动发现这些工具；不需要另行启动 HTTP 服务，也不会把笔记数据上传到第三方。

## 可用工具

| 工具 | 用途 |
| --- | --- |
| `list_notebooks` | 列出可访问的应用内记事本和已挂载的本地文件夹记事本。默认不返回本地绝对路径。 |
| `list_notes` | 按记事本、来源、回收站状态和排序规则分页列出笔记。 |
| `search_notes` | 在标题和正文中检索笔记；标题命中优先。 |
| `get_note` | 读取单篇笔记的纯文本正文和原始 BlockNote JSON 或 Markdown。 |

`list_notes` 和 `search_notes` 均返回 `total`、`items` 和 `nextOffset`。将 `nextOffset` 作为下一次调用的 `offset`；为 `null` 时表示没有更多结果。

## 数据范围与限制

- 工具只读，不会新建、修改、删除或移动笔记。
- 本地文件夹仅扫描 `.md`、`.markdown` 文件，且会忽略隐藏目录、`node_modules`、`.git` 等目录。
- `get_note` 返回原始内容，调用端应按需读取，避免一次获取大量笔记正文。
- 本地文件夹路径不可用或不可读取时，`list_notebooks` 会以 `availability` 标识状态；读取该记事本的笔记会返回明确错误。

## 开发验证

```bash
node --test preload/mcp-tools.test.cjs
bun run build
```

构建完成后，在 uTools 开发者工具中加载 `dist/plugin.json`，MCP 工具声明和 `preload.js` 中的 `utools.registerTool` 实现会一并进入插件包。
