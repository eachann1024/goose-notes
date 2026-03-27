import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "playwright/test";
import {
  bootApp,
  createPageFromSidebar,
  installHostMocks,
  seedPersistedWorkspaceState,
  readUToolsAiCalls,
  seedUToolsAiState,
  writeNote,
} from "./helpers";

async function seedAiSettings(
  page: Page,
  overrides?: {
    enabled?: boolean;
    selectedModelId?: string | null;
    workspaceSelectedModelId?: string | null;
    workspaceReasoningLevel?: "low" | "medium" | "high";
    useCustomProvider?: boolean;
    customProtocol?: "openai" | "claude";
    customOpenAIBaseURL?: string;
    customClaudeBaseURL?: string;
    customOpenAIApiKey?: string;
    customClaudeApiKey?: string;
    customModelOptions?: Array<{
      id: string;
      label: string;
      description?: string;
    }>;
  },
) {
  await page.addInitScript((payload) => {
    const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
    if (!state.state) state.state = {};

    state.state.ai = {
      enabled: payload.enabled,
      selectedModelId: payload.selectedModelId,
      workspaceSelectedModelId: payload.workspaceSelectedModelId,
      workspaceReasoningLevel: payload.workspaceReasoningLevel,
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
    selectedModelId: overrides?.selectedModelId ?? "alpha-model",
    workspaceSelectedModelId: overrides?.workspaceSelectedModelId ?? null,
    workspaceReasoningLevel: overrides?.workspaceReasoningLevel ?? "high",
    useCustomProvider: overrides?.useCustomProvider ?? true,
    customProtocol: overrides?.customProtocol ?? "openai",
    customOpenAIBaseURL: overrides?.customOpenAIBaseURL ?? "https://api.openai.com/v1",
    customClaudeBaseURL: overrides?.customClaudeBaseURL ?? "https://api.anthropic.com/v1",
    customOpenAIApiKey: overrides?.customOpenAIApiKey ?? "test-key",
    customClaudeApiKey: overrides?.customClaudeApiKey ?? "",
    customModelOptions: overrides?.customModelOptions ?? [
      { id: "alpha-model", label: "Alpha Model" },
      { id: "beta-model", label: "Beta Model" },
    ],
  });
}

async function openAiWorkspace(page: Page) {
  await page.locator('button[aria-label="打开 AI 页面"]').click();
  await expect(page.locator('[data-ai-workspace-composer="true"]')).toBeVisible();
}

async function selectWorkspaceModel(page: Page, label: string) {
  await page.locator('[data-ai-workspace-model-trigger="true"]').click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
}

async function selectReasoningLevel(page: Page, label: "低" | "中" | "高") {
  await page.locator('[data-ai-workspace-reasoning-trigger="true"]').click();
  await page.getByRole("menuitemradio", { name: new RegExp(`^${label}`) }).click();
}

async function submitWorkspacePrompt(page: Page, prompt: string) {
  const input = page.locator('[data-ai-composer-editor="true"]').first();
  await expect(input).toBeVisible();
  await input.click();
  await input.type(prompt);
  await page.locator('[data-ai-workspace-send="true"]').click();
}

async function startMockOpenAIStreamServer() {
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      });
      res.end();
      return;
    }

    if (req.url !== "/v1/chat/completions" || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    requests.push(Buffer.concat(chunks).toString("utf8"));

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-workspace",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "beta-model",
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      })}\n\n`,
    );

    await delay(50);

    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-workspace",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "beta-model",
        choices: [{ index: 0, delta: { content: "模拟结果" }, finish_reason: null }],
      })}\n\n`,
    );

    await delay(50);

    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-workspace",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "beta-model",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`,
    );
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
    getRequests: () => [...requests],
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

test.describe("独立 AI 页面底栏", () => {
  test("显示模型、推理等级和发送按钮", async ({ page }) => {
    await seedAiSettings(page);
    await installHostMocks(page);
    await page.goto("/");
    await expect(page.locator('button[aria-label="新建页面"]')).toBeVisible();
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);

    const composer = page.locator('[data-ai-workspace-composer="true"]');
    await expect(composer.locator('[data-ai-workspace-model-trigger="true"]')).toContainText("Alpha Model");
    await expect(composer.locator('[data-ai-workspace-reasoning-trigger="true"]')).toContainText("高");
    await expect(composer.locator('[data-ai-workspace-send="true"]')).toBeVisible();
    await expect(composer.locator("button")).toHaveCount(3);
  });

  test("独立 AI 页输入框左右内边距已收紧", async ({ page }) => {
    await seedAiSettings(page);
    await installHostMocks(page);
    await page.goto("/");
    await expect(page.locator('button[aria-label="新建页面"]')).toBeVisible();
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);

    const composer = page.locator('[data-ai-workspace-composer="true"]');
    await expect(composer).toBeVisible();
    await expect
      .poll(async () => {
        return composer.evaluate((node) => {
          const style = window.getComputedStyle(node);
          return {
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
          };
        });
      })
      .toEqual({
        paddingLeft: "10.5px",
        paddingRight: "10.5px",
      });
  });

  test("应用页引用卡片会隐藏应用标识并留出右侧间距", async ({ page }) => {
    await seedAiSettings(page);
    await seedPersistedWorkspaceState(page, {
      notebooks: [
        {
          id: "default-notebook",
          name: "Note",
          icon: "📓",
          source: "default",
        },
      ],
      pages: [
        {
          id: "app-reference-page",
          workspaceId: "default-notebook",
          content: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "应用参考页" }],
              },
            ],
          },
        },
      ],
    });
    await installHostMocks(page);
    await page.goto("/");
    await expect(page.locator('button[aria-label="新建页面"]')).toBeVisible();
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);

    const composer = page.locator('[data-ai-composer-editor="true"]').first();
    await expect(composer).toBeVisible();
    await composer.click();
    await composer.type("@应用参考");
    await expect(page.locator("[data-ai-reference-menu]")).toContainText(
      "应用参考页",
    );
    await page.keyboard.press("Enter");

    const chip = page.locator('[data-type="ai-file-reference"]').first();
    await expect(chip).toContainText("应用参考页");
    await expect(
      chip.locator('[data-ai-reference-source-label="true"]'),
    ).toHaveCount(0);

    await expect
      .poll(async () => {
        return chip.evaluate((element) => {
          const style = getComputedStyle(element as HTMLElement);
          return {
            marginLeft: Number.parseFloat(style.marginLeft),
            marginRight: Number.parseFloat(style.marginRight),
          };
        });
      })
      .toMatchObject({
        marginLeft: expect.any(Number),
        marginRight: expect.any(Number),
      });

    const chipSpacing = await chip.evaluate((element) => {
      const style = getComputedStyle(element as HTMLElement);
      return {
        marginLeft: Number.parseFloat(style.marginLeft),
        marginRight: Number.parseFloat(style.marginRight),
      };
    });

    expect(chipSpacing.marginLeft).toBeGreaterThan(0);
    expect(chipSpacing.marginRight).toBeGreaterThan(chipSpacing.marginLeft);
  });

  test("左移后输入不会把 @ 引用卡片替换掉", async ({ page }) => {
    await seedAiSettings(page);
    await seedPersistedWorkspaceState(page, {
      notebooks: [
        {
          id: "default-notebook",
          name: "Note",
          icon: "📓",
          source: "default",
        },
      ],
      pages: [
        {
          id: "app-reference-page",
          workspaceId: "default-notebook",
          content: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "鹅的笔记·新手指南" }],
              },
            ],
          },
        },
      ],
    });
    await installHostMocks(page);
    await page.goto("/");
    await expect(page.locator('button[aria-label="新建页面"]')).toBeVisible();
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);

    const composer = page.locator('[data-ai-composer-editor="true"]').first();
    await expect(composer).toBeVisible();
    await composer.click();
    await composer.type("@鹅的笔记");
    await expect(page.locator("[data-ai-reference-menu]")).toContainText(
      "鹅的笔记·新手指南",
    );
    await page.keyboard.press("Enter");

    const chip = page.locator('[data-type="ai-file-reference"]').first();
    await expect(chip).toContainText("鹅的笔记·新手指南");

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("A");

    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText("鹅的笔记·新手指南");
    await expect(composer).toContainText("A");
  });

  test("独立 AI 页模型会持久化且不覆盖设置默认模型", async ({ page }) => {
    await seedAiSettings(page, {
      selectedModelId: "alpha-model",
      workspaceSelectedModelId: null,
    });
    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);
    await selectWorkspaceModel(page, "Beta Model");
    await expect(page.locator('[data-ai-workspace-model-trigger="true"]')).toContainText("Beta Model");

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
          return {
            selectedModelId: state.state?.ai?.selectedModelId ?? null,
            workspaceSelectedModelId: state.state?.ai?.workspaceSelectedModelId ?? null,
          };
        });
      })
      .toEqual({
        selectedModelId: "alpha-model",
        workspaceSelectedModelId: "beta-model",
      });

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const state = JSON.parse(window.localStorage.getItem("goose-note-settings") || "{}");
          return {
            selectedModelId: state.state?.ai?.selectedModelId ?? null,
            workspaceSelectedModelId: state.state?.ai?.workspaceSelectedModelId ?? null,
          };
        });
      })
      .toEqual({
        selectedModelId: "alpha-model",
        workspaceSelectedModelId: "beta-model",
      });
  });

  test("自定义 OpenAI 请求会带上当前模型和推理等级", async ({ page }) => {
    const mockServer = await startMockOpenAIStreamServer();

    try {
      await seedAiSettings(page, {
        customOpenAIBaseURL: mockServer.baseURL,
      });
      await bootApp(page);
      await createPageFromSidebar(page);
      await writeNote(page, "当前页面", "这里是当前页面正文。");

      await openAiWorkspace(page);
      await selectWorkspaceModel(page, "Beta Model");
      await selectReasoningLevel(page, "低");
      await submitWorkspacePrompt(page, "总结一下当前页面");

      await expect.poll(() => mockServer.getRequests().length).toBe(1);
      const requestBody = mockServer.getRequests()[0] ?? "";

      expect(requestBody).toContain('"model":"beta-model"');
      expect(requestBody).toContain('"reasoning_effort":"low"');
    } finally {
      await mockServer.close();
    }
  });

  test("uTools ai() 会透传当前模型和推理等级", async ({ page }) => {
    await seedAiSettings(page, {
      useCustomProvider: false,
      selectedModelId: "deepseek-v3",
      workspaceSelectedModelId: null,
      customOpenAIApiKey: "",
    });
    await seedUToolsAiState(page, {
      models: [
        { id: "deepseek-v3", label: "DeepSeek V3" },
        { id: "deepseek-r1", label: "DeepSeek R1" },
      ],
    });
    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, "当前页面", "这里是当前页面正文。");

    await openAiWorkspace(page);
    await selectWorkspaceModel(page, "DeepSeek R1");
    await selectReasoningLevel(page, "中");
    await submitWorkspacePrompt(page, "用一句话总结");

    await expect.poll(async () => (await readUToolsAiCalls(page)).length).toBe(1);
    await expect
      .poll(async () => {
        const calls = await readUToolsAiCalls(page);
        return calls[0] ?? null;
      })
      .toMatchObject({
        model: "deepseek-r1",
        reasoningEffort: "medium",
      });
  });
});
