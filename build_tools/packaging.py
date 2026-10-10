"""Goose Note 构建：packaging。"""

from __future__ import annotations

import argparse
import subprocess
from .common import (ROOT, PACK_DIR, DESKTOP_DIR, IS_MAC, IS_WIN, IS_LINUX, log, die, read_version, require_tool, run, builder_env)
from .processes import (cmd_kill)


def cmd_build(args: argparse.Namespace) -> None:
    bun = require_tool("bun", "参考 DEVELOP.md 安装 Bun 1.3.14。")
    if not args.no_install:
        run([bun, "install", "--frozen-lockfile"], tag="build")
    run([bun, "run", "build:electron"], tag="build")
    log("build", f"编译完成：dist-electron/（renderer + main + preload + app-pack），版本 {read_version()}")


def package_with_builder(linux_targets: str | None) -> None:
    if not PACK_DIR.is_dir() or not (PACK_DIR / "package.json").is_file():
        die("package", f"缺少 {PACK_DIR}，请先执行 python3 build.py build")
    require_tool("node", "编译产物需要 Node.js 20+。")
    cmd: list[str]
    if IS_MAC:
        cmd = ["electron-builder", "--mac", "--arm64", "--config.mac.target=dir"]
    elif IS_WIN:
        cmd = ["electron-builder", "--win", "nsis", "--x64"]
    else:
        # 多目标作为 --linux 后的独立参数传入（electron-builder 不认逗号串）。
        cmd = ["electron-builder", "--linux"]
        if linux_targets:
            cmd.extend(t.strip() for t in linux_targets.split(",") if t.strip())
    try:
        display = " ".join(cmd)
        log("package", f"$ {display}  (cwd={PACK_DIR})")
        subprocess.run(cmd, cwd=PACK_DIR, env=builder_env(), check=True, shell=IS_WIN)
    except subprocess.CalledProcessError as error:
        if IS_LINUX:
            log(
                "package",
                "提示：Linux 全目标打包（含 pacman）需要 libarchive-tools"
                "（sudo apt install libarchive-tools）；"
                "或用 --linux-targets AppImage,deb 只出部分目标。",
            )
        die("package", f"electron-builder 退出码 {error.returncode}")
    run(["node", "scripts/collect-desktop-artifacts.mjs"], cwd=ROOT, tag="package")


def cmd_package(args: argparse.Namespace) -> None:
    # 打包前强杀：旧实例持有 SingletonLock 与挂载的 AppImage，会阻塞覆盖安装。
    cmd_kill(args)
    package_with_builder(args.linux_targets)
    artifacts = sorted(
        p.name for p in DESKTOP_DIR.iterdir() if p.is_file()
    ) if DESKTOP_DIR.is_dir() else []
    log("package", f"产物已收集到 {DESKTOP_DIR}/：{', '.join(artifacts) or '(空)'}")
