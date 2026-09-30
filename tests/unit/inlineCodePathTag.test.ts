import { expect, test } from "playwright/test";
import {
  __resetProbeCacheForTests,
  isInsideRoot,
  isRelativePathCandidate,
  peekProbe,
  probePath,
  resolveCandidatePath,
  toMarkdownTarget,
} from "../../src/components/editor/inline-code/localPathTarget";

test.describe("isRelativePathCandidate", () => {
  test("认 ./ 与 ../ 前缀（无后缀或 .md）", () => {
    expect(isRelativePathCandidate("./beta")).toBe(true);
    expect(isRelativePathCandidate("./beta.md")).toBe(true);
    expect(isRelativePathCandidate("./BETA.MD")).toBe(true);
    expect(isRelativePathCandidate("./a.b.md")).toBe(true);
    expect(isRelativePathCandidate("./docs/api")).toBe(true);
    expect(isRelativePathCandidate("../a/b")).toBe(true);
    expect(isRelativePathCandidate("../../x")).toBe(true);
  });

  test("拒绝非 .md 扩展名", () => {
    expect(isRelativePathCandidate("./img.png")).toBe(false);
    expect(isRelativePathCandidate("./a.md.txt")).toBe(false);
    expect(isRelativePathCandidate("./notes.pdf")).toBe(false);
  });

  test("拒绝目录意图（斜杠结尾）", () => {
    expect(isRelativePathCandidate("./docs/")).toBe(false);
    expect(isRelativePathCandidate("./docs\\")).toBe(false);
  });

  test("拒绝非相对路径与 URL", () => {
    expect(isRelativePathCandidate("agent")).toBe(false);
    expect(isRelativePathCandidate("/abs/p")).toBe(false);
    expect(isRelativePathCandidate("https://x/y")).toBe(false);
    expect(isRelativePathCandidate("./https://x")).toBe(false);
  });

  test("拒绝空前缀内容与非法字符", () => {
    expect(isRelativePathCandidate("./")).toBe(false);
    expect(isRelativePathCandidate("../")).toBe(false);
    expect(isRelativePathCandidate(".")).toBe(false);
    expect(isRelativePathCandidate("./a\nb")).toBe(false);
    expect(isRelativePathCandidate("./a*b")).toBe(false);
    expect(isRelativePathCandidate("./a?b")).toBe(false);
    expect(isRelativePathCandidate('./a"b')).toBe(false);
  });

  test("超长路径拒绝", () => {
    expect(isRelativePathCandidate(`./${"a".repeat(511)}`)).toBe(false);
    expect(isRelativePathCandidate(`./${"a".repeat(510)}`)).toBe(true);
  });
});

test.describe("toMarkdownTarget", () => {
  test("无扩展名补 .md", () => {
    expect(toMarkdownTarget("./beta")).toBe("./beta.md");
    expect(toMarkdownTarget("./docs/api")).toBe("./docs/api.md");
  });

  test("已有 .md 不重复追加，扩展名大小写不敏感", () => {
    expect(toMarkdownTarget("./beta.md")).toBe("./beta.md");
    expect(toMarkdownTarget("./i18n.MD")).toBe("./i18n.MD");
  });

  test("隐藏文件按无扩展名补 .md", () => {
    expect(toMarkdownTarget("./.env")).toBe("./.env.md");
  });

  test("非候选返回 null", () => {
    expect(toMarkdownTarget("./img.png")).toBeNull();
    expect(toMarkdownTarget("agent")).toBeNull();
  });
});

test.describe("resolveCandidatePath", () => {
  test("按笔记文件所在目录解析（补后路径）", () => {
    expect(resolveCandidatePath("./beta.md", "/root/n/note.md")).toBe(
      "/root/n/beta.md",
    );
    expect(resolveCandidatePath("../beta.md", "/root/n/note.md")).toBe(
      "/root/beta.md",
    );
  });

  test("嵌套相对路径按当前本地笔记目录解析", () => {
    expect(
      resolveCandidatePath("../docs/./i18n.MD", "/root/guide/current.md"),
    ).toBe("/root/docs/i18n.MD");
  });

  test("弹栈越界返回 null", () => {
    expect(
      resolveCandidatePath("../../../../x.md", "/root/n/note.md"),
    ).toBeNull();
  });

  test("Windows 反斜杠基路径", () => {
    expect(resolveCandidatePath("./a.md", "C:\\r\\n\\note.md")).toBe(
      "C:\\r\\n\\a.md",
    );
  });

  test("非候选文本返回 null", () => {
    expect(resolveCandidatePath("agent", "/root/n/note.md")).toBeNull();
  });
});

test.describe("isInsideRoot", () => {
  test("根内子孙命中", () => {
    expect(isInsideRoot("/root/n/agent", "/root")).toBe(true);
    expect(isInsideRoot("/root/a", "/root/")).toBe(true);
  });

  test("根外与 root 本身不命中", () => {
    expect(isInsideRoot("/root2/x", "/root")).toBe(false);
    expect(isInsideRoot("/root", "/root")).toBe(false);
  });

  test("前缀伪命中必须挡住", () => {
    expect(isInsideRoot("/rootx/a", "/root")).toBe(false);
  });

  test("Windows 盘符大小写不敏感", () => {
    expect(isInsideRoot("c:\\Root\\n\\a", "C:\\root")).toBe(true);
  });
});

test.describe("probePath 缓存", () => {
  test.beforeEach(() => {
    __resetProbeCacheForTests();
  });

  test("同一路径只触发一次 IO", async () => {
    let calls = 0;
    const existsAsync = async () => {
      calls += 1;
      return true;
    };
    const noop = () => {};
    probePath("/root/a", existsAsync, noop);
    probePath("/root/a", existsAsync, noop);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(1);
    expect(peekProbe("/root/a")).toBe("hit");
    // 未过期缓存不再发起 IO
    probePath("/root/a", existsAsync, noop);
    expect(calls).toBe(1);
  });

  test("reject 记为 miss", async () => {
    const existsAsync = async () => {
      throw new Error("io failure");
    };
    probePath("/root/b", existsAsync, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(peekProbe("/root/b")).toBe("miss");
  });

  test("onSettled 在探测完成后被调用", async () => {
    let settled = 0;
    probePath("/root/c", async () => false, () => {
      settled += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(1);
    expect(peekProbe("/root/c")).toBe("miss");
  });

  test("__resetProbeCacheForTests 清空缓存", async () => {
    probePath("/root/d", async () => true, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(peekProbe("/root/d")).toBe("hit");
    __resetProbeCacheForTests();
    expect(peekProbe("/root/d")).toBe("unknown");
  });
});
