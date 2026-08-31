import { expect, test } from "playwright/test";
import { transcodeVideo } from "../../src/lib/videoProcessor";

test("transcodeVideo passes the original file through when FFmpeg is unavailable", async () => {
  // 单元测试运行在 Node 环境，无 window.utools.runFFmpeg，
  // 与 Electron 桌面端 / 浏览器宿主一致：原文件透传，不转码。
  const file = new File(["fake-video"], "clip.webm", { type: "video/webm" });
  const result = await transcodeVideo(file);
  expect(result).toBe(file);
});
