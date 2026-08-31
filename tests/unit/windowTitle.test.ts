import { expect, test } from "playwright/test";
import {
  DEFAULT_WINDOW_TITLE,
  resolveWindowTitle,
  WELCOME_WINDOW_TITLE,
} from "../../src/lib/electron/windowTitle";
import type { Page } from "../../src/types";

test("window title falls back to Goose Note without a page", () => {
  expect(resolveWindowTitle(null)).toBe(DEFAULT_WINDOW_TITLE);
  expect(resolveWindowTitle(undefined)).toBe(DEFAULT_WINDOW_TITLE);
});

test("welcome tab uses the welcome title", () => {
  expect(resolveWindowTitle(null, { isWelcomeTab: true })).toBe(
    WELCOME_WINDOW_TITLE,
  );
});

test("local file page uses the file name without extension", () => {
  const page = {
    localFilePath: "/x/登录页面提示词.md",
    content: [],
  } as unknown as Page;
  expect(resolveWindowTitle(page)).toBe("登录页面提示词");
});
