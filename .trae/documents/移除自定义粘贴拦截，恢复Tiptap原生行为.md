## 目标
移除所有破坏性的粘贴处理逻辑，让 Tiptap 的 `tiptap-markdown` 插件处理 Markdown 粘贴，恢复原生复制粘贴体验。

## 具体步骤

### 步骤 1: 移除 EditorPasteHandler.ts 中的破坏性逻辑

**文件**: `src/extensions/EditorPasteHandler.ts`

**需要移除/修改的代码块**:

1. **第 343-357 行** - 移除 `shouldForceInlinePaste` 逻辑
   - 这段代码在标题/列表项内粘贴时，将所有换行替换为空格
   - 删除整个 `if (isInlineContext && shouldForceInlinePaste($from))` 代码块

2. **第 359-365 行** - 移除行内简单文本粘贴逻辑
   - 这段代码删除所有换行符
   - 删除整个 `if (isInlineContext && !hasMarkdownStructure(processedTextPlain))` 代码块

3. **保留的功能** (可选):
   - `convertChineseLists` - 中文列表转换（如果你需要）
   - `convertCodeLines` - 代码行自动检测（如果你需要）
   - 表格粘贴处理（第 367-379 行）- 如果你需要 Markdown 表格支持
   - 任务列表处理（第 420-510 行）- 如果你需要任务列表正常工作
   - HTML 粘贴处理（第 382-403 行）- 从 Word/浏览器复制时保留格式

### 步骤 2: 检查并调整其他粘贴处理器

**LinkPasteHandler.ts**:
- 这个只处理纯 URL 粘贴，不影响列表，可以保留

**TableCellCustom.ts**:
- 只在表格单元格内生效，将 `\n\n+` 替换为 `\n`
- 如果你希望表格内也能保留多行，可以移除或修改

**Editor.tsx 中的图片粘贴**:
- 只处理图片文件，不影响文本粘贴，保留

### 步骤 3: 检查复制行为

**ClipboardSerializer.ts**:
- 第 159-171 行：行内选区复制时强制纯文本
- 这段代码可能影响复制列表时的格式
- 建议移除或修改为只在特定情况下生效

### 步骤 4: 测试验证

修改后需要测试以下场景：
1. ✅ 从外部复制多层级有序列表粘贴到编辑器
2. ✅ 从外部复制无序列表粘贴到编辑器
3. ✅ 在列表项内粘贴多行内容
4. ✅ 复制编辑器内的列表粘贴到外部
5. ✅ 从 Word/网页复制带格式的内容
6. ✅ 粘贴图片仍然正常工作
7. ✅ 粘贴 URL 自动转换为链接（如果保留 LinkPasteHandler）

### 步骤 5: 清理（可选）

如果完全不需要 EditorPasteHandler 的功能，可以：
- 从 `editorExtensions.ts` 中移除 `EditorPasteHandler` 导入和配置
- 删除 `EditorPasteHandler.ts` 文件

## 预期结果

- 多层级的有序/无序列表复制粘贴将正常工作
- 列表的层级结构会被正确保留
- Tiptap 的 `tiptap-markdown` 插件将负责处理 Markdown 格式的粘贴
- 原生复制粘贴体验恢复

## 风险评估

- **低风险**: 移除破坏性逻辑后，Tiptap 有内置的粘贴处理机制
- **可能的影响**: 中文列表转换、代码自动检测等功能会丢失（如果完全移除文件）
- **缓解措施**: 可以只移除破坏性逻辑，保留其他有用的功能