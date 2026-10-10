"""Goose Note 构建：maintenance。"""

from __future__ import annotations

import argparse
import platform
import shutil
from .common import (ROOT, PACK_DIR, DESKTOP_DIR, log, die, read_version, require_tool, run)
from .processes import (find_installed_pids, find_dev_pids)


def cmd_release(_args: argparse.Namespace) -> None:
    artifacts = ROOT / "artifacts"
    if not artifacts.is_dir() or not any(artifacts.iterdir()):
        die(
            "release",
            f"{artifacts} 为空。publish-release.mjs 面向 CI 汇总的完整产物"
            "（双架构 dmg + 双架构 exe + AppImage/deb/pacman + macOS BUILD.json）；"
            "本地手工发布请先按 .github/workflows 汇总产物到 artifacts/。",
        )
    require_tool("gh", "发布需要 GitHub CLI 并已登录（gh auth login）。")
    run(["node", "scripts/publish-release.mjs"], cwd=ROOT, tag="release")


def cmd_clean(_args: argparse.Namespace) -> None:
    for directory in (ROOT / "dist-electron", DESKTOP_DIR):
        if directory.exists():
            shutil.rmtree(directory)
            log("clean", f"已删除 {directory}")
    log("clean", "完成。")


def cmd_status(_args: argparse.Namespace) -> None:
    installed = find_installed_pids()
    dev = find_dev_pids()
    log("status", f"版本：{read_version()}  平台：{platform.system()}")
    log("status", f"安装版进程：{installed or '无'}  开发实例：{dev or '无'}")
    log("status", f"app-pack：{'就绪' if (PACK_DIR / 'package.json').is_file() else '未构建'}")
    if DESKTOP_DIR.is_dir():
        artifacts = [p.name for p in sorted(DESKTOP_DIR.iterdir()) if p.is_file()]
        log("status", f"dist-desktop：{', '.join(artifacts) or '(空)'}")
    else:
        log("status", "dist-desktop：不存在")
