import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "playwright/test";
import { bootApp, createPageFromSidebar, writeNote } from "./helpers";

async function seedCustomOpenAISettings(page: Page, overrides?: {
  enabled?: boolean;
  selectedModelId?: string | null;
  useCustomProvider?: boolean;
  customBaseURL?: string;
  customModelOptions?: Array<{ id: string; label: string; description?: string }>;
}) {
  await page.addInitScript((payload) => {
    const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
    if (!state.state) state.state = {};

    state.state.ai = {
      enabled: payload.enabled,
      selectedModelId: payload.selectedModelId,
      useCustomProvider: payload.useCustomProvider,
      customProtocol: "openai",
      customBaseURL: payload.customBaseURL,
      customApiKey: "test-key",
      customModelOptions: payload.customModelOptions,
    };

    window.localStorage.setItem("goose-note-settings", JSON.stringify(state));
  }, {
    enabled: overrides?.enabled ?? true,
    selectedModelId: overrides?.selectedModelId ?? "mock-model",
    useCustomProvider: overrides?.useCustomProvider ?? true,
    customBaseURL: overrides?.customBaseURL ?? "https://api.example.com/v1",
    customModelOptions: overrides?.customModelOptions ?? [
      { id: "mock-model", label: "Mock Model" },
    ],
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
  test("自定义 OpenAI 协议可以触发润色并生成结果", async ({ page }) => {
    const mockServer = await startMockOpenAIStreamServer();

    try {
      await seedCustomOpenAISettings(page, {
        customBaseURL: mockServer.baseURL,
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

  test("保存自定义 AI 配置后默认模型自动切到第一项", async ({ page }) => {
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
      customModelOptions: [],
    });
    await bootApp(page);

    await page.getByLabel("设置").click();
    await page.getByRole("button", { name: "AI 助手" }).click();

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
});
