import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { CodeBlockComponent } from "./CodeBlockComponent";
import { LANGUAGE_ALIASES } from "./codeLanguageAliases";
import { codeBlockHighlightExtension } from "./codeHighlight";
import { codeBlockTabIndentExtension } from "./codeIndentExtension";
import { gooseCodeBlockActiveLineExtension } from "./codeBlockActiveLine";

export const codeBlockSpec = createReactBlockSpec(
  {
    type: "codeBlock",
    propSchema: {
      ...defaultProps,
      language: { default: "text" },
      wrap: { default: false },
      collapsed: { default: false },
      summary: { default: "" },
    },
    content: "inline",
  },
  {
    meta: { isolating: false },
    render: ({ block, contentRef, editor }) => (
      <CodeBlockComponent
        block={block}
        contentRef={contentRef}
        editor={editor}
      />
    ),
    // 粘贴/导入识别 <pre><code> → 还原为代码块(否则自定义 spec 覆盖了默认 codeBlock 的
    // 解析规则,从网页/富文本复制的代码块会因无 parse 而降级成普通段落)。
    // content="inline" 时,框架用匹配元素(<pre>)的文本内容作为代码内容,parse 只需回传 props。
    parse: (element: HTMLElement) => {
      const tag = element.tagName?.toUpperCase();
      // 标准结构 <pre>...</pre>;裸 <code class="language-x"> 由其外层 <pre> 处理,
      // 单独的 inline <code> 不在此拦截(交给默认 inline code 样式)。
      if (tag !== "PRE") return undefined;
      const codeEl = element.querySelector("code");
      const langSource = codeEl ?? element;
      // 语言来源:class="language-xxx" / "lang-xxx" / hljs 的 "language-xxx" / data-language。
      let language =
        langSource.getAttribute("data-language") ||
        langSource.getAttribute("data-lang") ||
        "";
      if (!language) {
        const cls = langSource.getAttribute("class") || "";
        const m = cls.match(/(?:language|lang)-([\w+#-]+)/i);
        if (m) language = m[1];
      }
      const normalized = language
        ? (LANGUAGE_ALIASES[language.trim().toLowerCase()] ??
          language.trim().toLowerCase())
        : "text";
      return { language: normalized };
    },
    toExternalHTML: ({ block, contentRef }) => {
      const lang = (block.props?.language || "text").trim();
      return (
        <pre>
          <code
            ref={contentRef}
            className={lang ? `language-${lang}` : undefined}
          />
        </pre>
      );
    },
  },
  [
    codeBlockHighlightExtension,
    codeBlockTabIndentExtension,
    gooseCodeBlockActiveLineExtension,
  ],
)();
