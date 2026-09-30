import { expect, test } from "playwright/test";
import {
  getWorkCardHeading,
  getWorkCardPhase,
} from "../../src/pages/workspace/components/notebook-ai/workCardHeading";
import type { ProgressStep } from "../../src/pages/workspace/components/notebook-ai/toolProgressModel";

const doneRead: ProgressStep = {
  label: "读取笔记",
  detail: "已读取《AI 功能演示》",
  status: "done",
};
const doneWrite: ProgressStep = {
  label: "追加内容",
  detail: "已追加到《AI 功能演示》",
  status: "done",
};
const runningPlan: ProgressStep = {
  label: "生成批量计划",
  detail: "正在生成《精简健康作息文案》",
  status: "running",
};
const conflict: ProgressStep = {
  label: "写入页面",
  detail: "页面内容已发生变化，为避免覆盖新的编辑，本次写入已取消",
  status: "error",
};

test("完成态标题只用最后一步，不拼接成日志行", () => {
  const heading = getWorkCardHeading([doneRead, doneWrite], "done");
  expect(heading.kicker).toBe("处理完成");
  expect(heading.title).toBe("已追加到《AI 功能演示》");
  expect(heading.title).not.toContain("、");
  expect(heading.toggle).toBe("2 步 · 追加内容");
  expect(heading.tone).toBe("neutral");
});

test("进行中用当前步骤当标题", () => {
  const heading = getWorkCardHeading([doneRead, runningPlan], "running");
  expect(heading.kicker).toBe("处理中");
  expect(heading.title).toBe("正在生成《精简健康作息文案》");
  expect(heading.toggle).toBe("2 步 · 生成批量计划");
});

test("冲突写入失败：短标题，不把整段错误当标题", () => {
  const heading = getWorkCardHeading([doneRead, conflict], "error");
  expect(heading.kicker).toBe("写入已取消");
  expect(heading.title).toBe("页面已被改过");
  expect(heading.title.length).toBeLessThan(20);
  expect(heading.tone).toBe("danger");
});

test("普通错误用首句缩短，不把长错误铺满标题", () => {
  const heading = getWorkCardHeading(
    [
      {
        label: "读取笔记",
        detail: "读取超时，请检查网络后重试。还可以换一个模型。",
        status: "error",
      },
    ],
    "error",
  );
  expect(heading.kicker).toBe("处理失败");
  expect(heading.title).toBe("读取超时，请检查网络后重试");
  expect(heading.title).not.toContain("还可以");
});

test("没有步骤时仍能给进行中标题", () => {
  const heading = getWorkCardHeading([], "running");
  expect(heading.title).toBe("正在处理");
  expect(heading.toggle).toBe("");
});

test("phase：有错误优先，其次 running", () => {
  expect(getWorkCardPhase([doneRead, conflict], true)).toBe("error");
  expect(getWorkCardPhase([doneRead, runningPlan], true)).toBe("running");
  expect(getWorkCardPhase([doneRead], false)).toBe("done");
});
