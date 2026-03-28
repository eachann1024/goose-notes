import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "playwright/test";
import { bootApp, createPageFromSidebar, writeNote } from "./helpers";

async function seedCustomOpenAISettings(page: Page, overrides?: {
  enabled?: boolean;
  selectedModelId?: string | null;
  useCustomProvider?: boolean;
  customProtocol?: "openai" | "claude";
  customOpenAIBaseURL?: string;
  customClaudeBaseURL?: string;
  customOpenAIApiKey?: string;
  customClaudeApiKey?: string;
  customModelOptions?: Array<{ id: string; label: string; description?: string }>;
}) {
  await page.addInitScript((payload) => {
    const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
    if (!state.state) state.state = {};

    state.state.ai = {
      enabled: payload.enabled,
      selectedModelId: payload.selectedModelId,
      useCustomProvider: payload.useCustomProvider,
      customProtocol: payload.customProtocol,
      customOpenAIBaseURL: payload.customOpenAIBaseURL,
      customClaudeBaseURL: payload.customClaudeBaseURL,
      customOpenAIApiKey: payload.customOpenAIApiKey,
      customClaudeApiKey: payload.customClaudeApiKey,
      customModelOptions: payload.customModelOptions,
    };

    window.localStorage.setItem("goose-note-settings", JSON.stringify(state));
  }, {
    enabled: overrides?.enabled ?? true,
    selectedModelId: overrides?.selectedModelId ?? "mock-model",
    useCustomProvider: overrides?.useCustomProvider ?? true,
    customProtocol: overrides?.customProtocol ?? "openai",
    customOpenAIBaseURL: overrides?.customOpenAIBaseURL ?? "https://api.openai.com/v1",
    customClaudeBaseURL: overrides?.customClaudeBaseURL ?? "https://api.anthropic.com/v1",
    customOpenAIApiKey: overrides?.customOpenAIApiKey ?? "test-key",
    customClaudeApiKey: overrides?.customClaudeApiKey ?? "",
    customModelOptions: overrides?.customModelOptions ?? [
      { id: "mock-model", label: "Mock Model" },
    ],
  });
}

async function openAISettings(page: Page) {
  await page.getByLabel("设置").click();
  await page.getByRole("button", { name: "AI 助手" }).click();
}

async function switchCustomProtocol(page: Page, currentLabel: RegExp, targetLabel: RegExp) {
  await page.getByRole("button", { name: currentLabel }).click();
  await page.getByRole("menuitemradio", { name: targetLabel }).click();
}

async function setSelectedBulletList(page: Page, items: string[]) {
  await page.evaluate((payload) => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    if (!editor) {
      throw new Error("编辑器未挂载");
    }

    editor.commands.setContent(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "AI 列表改写测试" }],
          },
          {
            type: "bulletList",
            content: payload.items.map((item) => ({
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: item }],
                },
              ],
            })),
          },
        ],
      },
      true,
    );

    let listRange: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node: any, pos: number) => {
      if (listRange) return false;
      if (node.type.name === "bulletList") {
        listRange = { from: pos, to: pos + node.nodeSize };
        return false;
      }
      return true;
    });

    if (!listRange) {
      throw new Error("未找到无序列表");
    }

    let from: number | null = null;
    let to: number | null = null;
    editor.state.doc.nodesBetween(listRange.from, listRange.to, (node: any, pos: number) => {
      if (!node.isText) return true;
      if (from === null) {
        from = pos;
      }
      to = pos + node.text.length;
      return true;
    });

    if (from === null || to === null) {
      throw new Error("未找到列表文本范围");
    }

    editor.chain().focus().setTextSelection({ from, to }).run();

    document.dispatchEvent(
      new CustomEvent("open-ai-input-popover", {
        detail: { editor },
      }),
    );
  }, { items });
}

async function submitAiPrompt(page: Page, prompt: string) {
  const input = page.getByPlaceholder("让 AI 帮你写点什么...");
  await expect(input).toBeVisible();
  await input.fill(prompt);
  await input.press("Enter");
}

async function getFirstBodyNodeType(page: Page) {
  return page.evaluate(() => {
    const editor = (window as { __gooseNoteEditor?: { getJSON?: () => any } }).__gooseNoteEditor;
    return editor?.getJSON?.().content?.[1]?.type ?? null;
  });
}

async function startMockOpenAIStreamServer() {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-api-key, anthropic-version",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      });
      res.end();
      return;
    }

    if (req.url !== "/v1/chat/completions" || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(`data: ${JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          delta: { role: "assistant" },
          finish_reason: null,
        },
      ],
    })}\n\n`);

    await delay(180);

    res.write(`data: ${JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          delta: { content: "模拟的 " },
          finish_reason: null,
        },
      ],
    })}\n\n`);

    await delay(180);

    res.write(`data: ${JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          delta: { content: "AI 结果" },
          finish_reason: null,
        },
      ],
    })}\n\n`);

    await delay(120);

    res.write(`data: ${JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("无法启动 mock OpenAI 流式服务");
  }

  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

test.describe("AI 交互流程", () => {
  test("空白段落按空格会打开当前页 AI 浮窗而不是独立 AI 页面", async ({ page }) => {
    await seedCustomOpenAISettings(page);
    await bootApp(page);
    await createPageFromSidebar(page);

    await page.evaluate(() => {
      const editor = (
        window as {
          __gooseNoteEditor?: {
            commands?: {
              setContent?: (content: unknown, emitUpdate?: boolean) => void;
              focus?: (position: string | number) => void;
            };
          };
        }
      ).__gooseNoteEditor;

      if (!editor?.commands?.setContent || !editor.commands.focus) {
        throw new Error("编辑器未挂载");
      }

      editor.commands.setContent(
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "空格触发测试" }],
            },
            {
              type: "paragraph",
            },
          ],
        },
        true,
      );
      editor.commands.focus("end");
    });

    await page.keyboard.press("Space");

    await expect(page.locator("[data-ai-input-popover]")).toBeVisible();
    await expect(page.locator('[data-ai-workspace-composer="true"]')).toHaveCount(0);
  });

  test("空格唤起的 AI 输入框会把后续内容顶下去", async ({ page }) => {
    await seedCustomOpenAISettings(page);
    await bootApp(page);
    await createPageFromSidebar(page);

    await page.evaluate(() => {
      const editor = (
        window as {
          __gooseNoteEditor?: {
            commands?: {
              setContent?: (content: unknown, emitUpdate?: boolean) => void;
              focus?: (position: string | number) => void;
            };
            state?: {
              doc?: {
                descendants?: (fn: (node: any, pos: number) => boolean | void) => void;
              };
            };
          };
        }
      ).__gooseNoteEditor;

      if (!editor?.commands?.setContent || !editor.commands.focus || !editor.state?.doc?.descendants) {
        throw new Error("编辑器未挂载");
      }

      editor.commands.setContent(
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "空格顶开测试" }],
            },
            {
              type: "paragraph",
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "这段内容应该被往下推开，而不是被浮层挡住。" }],
            },
          ],
        },
        true,
      );

      let emptyParagraphPos: number | null = null;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type?.name === "paragraph" && node.content?.size === 0) {
          emptyParagraphPos = pos + 1;
          return false;
        }
        return true;
      });

      if (emptyParagraphPos == null) {
        throw new Error("未找到空段落");
      }

      editor.commands.focus(emptyParagraphPos);
    });

    const followingParagraph = page.locator(".ProseMirror p").nth(1);
    const beforeBox = await followingParagraph.boundingBox();
    expect(beforeBox).not.toBeNull();

    await page.keyboard.press("Space");
    await expect(page.locator('[data-ai-input-popover][data-ai-input-mode="inline"]')).toBeVisible();

    const afterBox = await followingParagraph.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(afterBox!.y).toBeGreaterThan((beforeBox?.y ?? 0) + 20);
  });

  test("选中无序列表后可通过 AI 指令改成有序列表", async ({ page }) => {
    await seedCustomOpenAISettings(page);
    await bootApp(page);
    await createPageFromSidebar(page);

    await setSelectedBulletList(page, ["条目一", "条目二", "条目三"]);
    await submitAiPrompt(page, "把选中的无序列表改成有序列表");

    await expect.poll(() => getFirstBodyNodeType(page)).toBe("orderedList");
  });

  test("选中无序列表后可通过 AI 指令改成提醒事项", async ({ page }) => {
    await seedCustomOpenAISettings(page);
    await bootApp(page);
    await createPageFromSidebar(page);

    await setSelectedBulletList(page, ["待处理一", "待处理二", "待处理三"]);
    await submitAiPrompt(page, "把选中的内容改成提醒事项");

    await expect.poll(() => getFirstBodyNodeType(page)).toBe("taskList");
  });

  test("自定义 OpenAI 协议可以触发润色并生成结果", async ({ page }) => {
    const mockServer = await startMockOpenAIStreamServer();

    try {
      await seedCustomOpenAISettings(page, {
        customOpenAIBaseURL: mockServer.baseURL,
      });
      await bootApp(page);
      await createPageFromSidebar(page);

      const title = "AI 测篇";
      const body = "这是一段需要被改写或润色的测试笔记文字。";
      await writeNote(page, title, body);

      await page.evaluate(() => {
        const editor = (
          window as {
            __gooseNoteEditor?: {
              state: {
                doc: {
                  firstChild?: { nodeSize?: number };
                  lastChild?: { nodeSize?: number };
                };
              };
              view: {
                coordsAtPos: (pos: number) => { left: number; top: number; right: number; bottom: number };
              };
              chain: () => {
                setTextSelection: (range: { from: number; to: number }) => {
                  run: () => void;
                };
              };
            };
          }
        ).__gooseNoteEditor;

        if (!editor) {
          throw new Error("编辑器未挂载");
        }

        const titleSize = editor.state.doc.firstChild?.nodeSize ?? 0;
        const bodySize = editor.state.doc.lastChild?.nodeSize ?? 0;
        const from = titleSize + 1;
        const to = from + Math.max(bodySize - 2, 1);

        editor.chain().setTextSelection({ from, to }).run();

        document.dispatchEvent(new CustomEvent("open-ai-input-popover", {
          detail: {
            editor,
            initialAction: "polish",
          },
        }));
      });

      const aiInput = page.getByPlaceholder("输入自定义润色要求...");
      await expect(aiInput).toBeVisible();
      await page.locator("[data-ai-input-popover] button").first().click();

      await expect(page.locator("[data-ai-input-popover]")).toContainText(/正在分析上下文与任务要求|正在连接|AI 思考中|正在生成/);
      await expect(page.getByText("模拟的 AI 结果")).toBeVisible();

      const applyButton = page.getByRole("button", { name: "应用" });
      await expect(applyButton).toBeVisible();
    } finally {
      await mockServer.close();
    }
  });

  test("应用页引用不显示源标签", async ({ page }) => {
    await seedCustomOpenAISettings(page);
    await bootApp(page);
    await createPageFromSidebar(page);

    await writeNote(page, "应用参考页", "这里是应用页正文。");

    await page.locator('button[aria-label="打开 AI 页面"]').click();
    const composer = page.locator('[data-ai-composer-editor="true"]').first();
    await expect(composer).toBeVisible();
    await composer.click();
    await composer.type("@应用参考页");
    await expect(page.locator("[data-ai-reference-menu]")).toContainText(
      "应用参考页",
    );
    await page.keyboard.press("Enter");

    await expect(page.locator('[data-type="ai-file-reference"]')).toHaveCount(
      1,
    );
    await expect(
      page.locator(
        '[data-type="ai-file-reference"] [data-ai-reference-source-label="true"]',
      ),
    ).toHaveCount(0);
  });

  test("保存自定义 OpenAI 配置后默认模型自动切到第一项", async ({ page }) => {
    await page.route("https://api.example.com/v1/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { id: "alpha-model", name: "Alpha Model" },
            { id: "beta-model", name: "Beta Model" },
          ],
        }),
      });
    });

    await seedCustomOpenAISettings(page, {
      enabled: false,
      selectedModelId: null,
      useCustomProvider: false,
      customOpenAIApiKey: "",
      customModelOptions: [],
    });
    await bootApp(page);

    await openAISettings(page);

    await page.getByRole("switch", { name: "启用 AI 写作助手" }).click();
    await page.getByRole("switch", { name: "关闭 utoolsAI 使用自定义 AI" }).click();

    await page.getByLabel("Base URL").fill("https://api.example.com/v1");
    await page.getByLabel("API Key").fill("test-key");
    await page.getByRole("button", { name: "保存", exact: true }).first().click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
        return state.state?.ai?.selectedModelId ?? null;
      });
    }).toBe("alpha-model");

    await expect(page.getByRole("button", { name: /Alpha Model/ })).toBeVisible();
  });

  test("Claude 协议支持自定义 Base URL 并读取模型", async ({ page }) => {
    await page.route("https://claude-proxy.example.com/v1/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { id: "claude-model", display_name: "Claude Model" },
          ],
        }),
      });
    });

    await seedCustomOpenAISettings(page, {
      enabled: false,
      selectedModelId: null,
      useCustomProvider: false,
      customOpenAIApiKey: "",
      customModelOptions: [],
    });
    await bootApp(page);
    await openAISettings(page);

    await page.getByRole("switch", { name: "启用 AI 写作助手" }).click();
    await page.getByRole("switch", { name: "关闭 utoolsAI 使用自定义 AI" }).click();
    await switchCustomProtocol(page, /OpenAI 兼容协议/, /Claude 协议/);

    const baseURLInput = page.getByLabel("Base URL");
    await expect(baseURLInput).toHaveValue("https://api.anthropic.com/v1");
    await baseURLInput.fill("https://claude-proxy.example.com/v1");
    await page.getByLabel("API Key").fill("claude-test-key");
    await page.getByRole("button", { name: "保存", exact: true }).first().click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
        return {
          selectedModelId: state.state?.ai?.selectedModelId ?? null,
          customClaudeBaseURL: state.state?.ai?.customClaudeBaseURL ?? null,
        };
      });
    }).toEqual({
      selectedModelId: "claude-model",
      customClaudeBaseURL: "https://claude-proxy.example.com/v1",
    });

    await expect(page.getByRole("button", { name: /Claude Model/ })).toBeVisible();
  });

  test("切换协议时 OpenAI 和 Claude 输入框各自保留", async ({ page }) => {
    await seedCustomOpenAISettings(page, {
      enabled: false,
      selectedModelId: null,
      useCustomProvider: false,
      customOpenAIApiKey: "",
      customModelOptions: [],
    });
    await bootApp(page);
    await openAISettings(page);

    await page.getByRole("switch", { name: "启用 AI 写作助手" }).click();
    await page.getByRole("switch", { name: "关闭 utoolsAI 使用自定义 AI" }).click();

    const baseURLInput = page.getByLabel("Base URL");
    const apiKeyInput = page.getByLabel("API Key");

    await expect(baseURLInput).toHaveValue("https://api.openai.com/v1");
    await expect(apiKeyInput).toHaveValue("");

    await baseURLInput.fill("https://openai-proxy.example.com/v1");
    await apiKeyInput.fill("openai-key");

    await switchCustomProtocol(page, /OpenAI 兼容协议/, /Claude 协议/);

    await expect(baseURLInput).toHaveValue("https://api.anthropic.com/v1");
    await expect(apiKeyInput).toHaveValue("");

    await baseURLInput.fill("https://claude-proxy.example.com/v1");
    await apiKeyInput.fill("claude-key");

    await switchCustomProtocol(page, /Claude 协议/, /OpenAI 兼容协议/);

    await expect(baseURLInput).toHaveValue("https://openai-proxy.example.com/v1");
    await expect(apiKeyInput).toHaveValue("openai-key");

    await switchCustomProtocol(page, /OpenAI 兼容协议/, /Claude 协议/);

    await expect(baseURLInput).toHaveValue("https://claude-proxy.example.com/v1");
    await expect(apiKeyInput).toHaveValue("claude-key");
  });
});
