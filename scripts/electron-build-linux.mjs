#!/usr/bin/env node
import { execSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

// Linux 桌面端打包：产出 AppImage / deb / rpm（目标在 prepare-electron-pack.mjs 生成的
// electron-builder.yml 中定义）。AppImage 可在 Omarchy / Arch 等发行版直接双击运行。
if (platform !== "linux") {
  console.error("[linux] bun run linux 面向 Linux 打包；当前平台不是 Linux。");
  console.error("       请在目标 Linux 系统（如 Omarchy / Arch）上执行。");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pack = resolve(root, "dist-electron/app-pack");

// 打包前强制停止正在运行的旧版 Goose Note（AppImage / deb / rpm 安装版通用）。
// 否则旧实例仍持有数据目录单实例锁（SingletonLock）与挂载的 AppImage，
// 新打包的 AppImage 无法覆盖，双击启动也会被聚焦到已卡死的旧窗口。
// 停止是尽力而为：杀进程失败不应中断打包，故整个函数用 try/catch 兜底。
function stopRunningApp() {
  const shell = (cmd) => {
    try {
      return execSync(cmd, { encoding: "utf8", shell: true }).trim();
    } catch {
      // 命令均带 `|| true`，仅真实 spawn 失败才会到这；视为无输出继续。
      return "";
    }
  };
  try {
    const proc = shell("pgrep -x goose-notes || true");
    if (!proc) {
      console.log("[linux] 未检测到正在运行的 Goose Note，跳过停止。");
      return;
    }
    console.log(
      `[linux] 检测到正在运行的 Goose Note（PID: ${proc.split(/\n/).join(", ")}），强制停止…`,
    );
    shell("pkill -x goose-notes || true");
    // 等待进程退出，最多 15 秒（SIGTERM 后仍未退则 SIGKILL）。
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (!shell("pgrep -x goose-notes || true")) {
        console.log("[linux] 旧实例已停止。");
        return;
      }
      shell("sleep 0.5");
    }
    console.log("[linux] 旧实例未在宽限期内退出，强制 SIGKILL…");
    shell("pkill -9 -x goose-notes || true");
  } catch (err) {
    console.warn(
      "[linux] 停止旧实例失败（继续打包）：",
      err.message || String(err),
    );
  }
}

stopRunningApp();

const env = {
  ...process.env,
  PATH: `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};
console.log("[linux] electron-builder --linux（AppImage / deb / rpm，未签名）");
try {
  execSync("electron-builder --linux", {
    stdio: "inherit",
    env,
    shell: true,
    cwd: pack,
  });
} catch (err) {
  console.error(
    "[linux] electron-builder 打包失败：",
    err.message || String(err),
  );
  process.exit(1);
}
