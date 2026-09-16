#!/usr/bin/env python3
"""Build the macOS app and install a copy into /Applications."""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

APP_NAME = "Goose Note"
ROOT = Path(__file__).resolve().parent
BUILT_APP = ROOT / "dist-desktop" / f"{APP_NAME}.app"
INSTALLED_APP = Path("/Applications") / f"{APP_NAME}.app"


def is_app_running() -> bool:
    return subprocess.run(
        ["pgrep", "-x", APP_NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    ).returncode == 0


def quit_running_app() -> bool:
    was_running = is_app_running()
    if not was_running:
        return False
    print(f"[mac] 正在运行 {APP_NAME}，先退出旧应用")
    subprocess.run(
        ["osascript", "-e", f'tell application "{APP_NAME}" to quit'],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.monotonic() + 15
    while is_app_running() and time.monotonic() < deadline:
        time.sleep(0.25)
    if is_app_running():
        raise RuntimeError(f"{APP_NAME} 未能在 15 秒内退出，已停止安装以避免覆盖运行中的应用")
    return was_running


def run_build() -> None:
    commands = [
        ["bun", "run", "build:electron"],
        ["node", "scripts/electron-build-mac.mjs"],
        ["node", "scripts/collect-desktop-artifacts.mjs"],
    ]
    for command in commands:
        subprocess.run(command, cwd=ROOT, check=True)


def install_copy() -> None:
    if not BUILT_APP.is_dir():
        raise FileNotFoundError(f"未找到构建产物：{BUILT_APP}")
    was_running = quit_running_app()
    if INSTALLED_APP.exists():
        print(f"[mac] 删除旧副本：{INSTALLED_APP}")
        shutil.rmtree(INSTALLED_APP)
    print(f"[mac] 复制到：{INSTALLED_APP}")
    shutil.copytree(BUILT_APP, INSTALLED_APP, symlinks=True)
    if was_running:
        print(f"[mac] 重新打开：{INSTALLED_APP}")
        subprocess.run(["open", str(INSTALLED_APP)], cwd=ROOT, check=True)


def main() -> int:
    if sys.platform != "darwin":
        print("[mac] 此脚本仅支持 macOS", file=sys.stderr)
        return 1
    try:
        run_build()
        install_copy()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"[mac] 失败：{error}", file=sys.stderr)
        return 1
    print(f"[mac] 已复制安装（原产物仍保留）：{INSTALLED_APP}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
