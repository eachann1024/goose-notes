import { expect, test } from "playwright/test";
import {
  consumeDiskWriteFailure,
  describeDiskWriteError,
  DiskWriteError,
  rememberDiskWriteFailure,
  toDiskWriteError,
} from "../../src/lib/diskWriteError";

test("EACCES 映射为可写权限不足，并识别 iCloud 路径", () => {
  const error = Object.assign(new Error("EACCES: permission denied, open '/home/eachann/iCloud/Note/a.md'"), {
    code: "EACCES",
  });
  expect(describeDiskWriteError(error, "/home/eachann/iCloud/Note/a.md")).toContain(
    "iCloud",
  );
  expect(describeDiskWriteError(error, "/home/eachann/iCloud/Note/a.md")).toContain(
    "无法写入",
  );
});

test("普通权限错误不误报云盘", () => {
  const error = Object.assign(new Error("EACCES: permission denied, open '/tmp/notes/a.md'"), {
    code: "EACCES",
  });
  expect(describeDiskWriteError(error, "/tmp/notes/a.md")).toContain("权限不足");
  expect(describeDiskWriteError(error, "/tmp/notes/a.md")).not.toContain("iCloud");
});

test("ENOSPC / EROFS / ENOENT 有各自文案", () => {
  expect(
    describeDiskWriteError(Object.assign(new Error("no space"), { code: "ENOSPC" })),
  ).toContain("磁盘空间不足");
  expect(
    describeDiskWriteError(Object.assign(new Error("erofs"), { code: "EROFS" })),
  ).toContain("只读");
  expect(
    describeDiskWriteError(Object.assign(new Error("missing"), { code: "ENOENT" })),
  ).toContain("不存在");
});

test("通用保存未完成错误不再提恢复备份", () => {
  const text = describeDiskWriteError(new Error("本地页面保存未完成：abc"));
  expect(text).toContain("未能写入磁盘");
  expect(text).not.toContain("恢复备份");
});

test("toDiskWriteError 保留 code，remember/consume 只取一次", () => {
  const raw = Object.assign(new Error("EACCES: permission denied"), {
    code: "EACCES",
  });
  const wrapped = toDiskWriteError(raw, "/vault/a.md");
  expect(wrapped).toBeInstanceOf(DiskWriteError);
  expect(wrapped.code).toBe("EACCES");
  rememberDiskWriteFailure(wrapped);
  expect(consumeDiskWriteFailure()).toBe(wrapped);
  expect(consumeDiskWriteFailure()).toBeNull();
});
