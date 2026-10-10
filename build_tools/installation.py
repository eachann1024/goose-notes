"""Goose Note 构建：installation。"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path
from .common import (APP_NAME, ROOT, DESKTOP_DIR, IS_MAC, IS_WIN, IS_LINUX, log, die, run)
from .processes import (cmd_kill)


def latest_desktop_artifact(*patterns: str) -> Path | None:
    if not DESKTOP_DIR.is_dir():
        return None
    candidates = [p for pattern in patterns for p in DESKTOP_DIR.glob(pattern)]
    return max(candidates, key=lambda p: p.stat().st_mtime) if candidates else None


def cmd_install(_args: argparse.Namespace) -> None:
    if IS_MAC:
        built = DESKTOP_DIR / f"{APP_NAME}.app"
        if not built.is_dir():
            die("install", f"未找到 {built}，请先执行 python3 build.py package")
        installed = Path("/Applications") / f"{APP_NAME}.app"
        cmd_kill(_args)
        if installed.exists():
            log("install", f"删除旧副本：{installed}")
            shutil.rmtree(installed)
        log("install", f"复制到：{installed}")
        shutil.copytree(built, installed, symlinks=True)
        log("install", f"已安装（原产物保留）：{installed}")
        return
    if IS_LINUX:
        deb = latest_desktop_artifact("*.deb")
        appimage = latest_desktop_artifact("*.AppImage")
        if not deb and not appimage:
            die("install", f"未找到 deb/AppImage 产物，请先执行 python3 build.py package")
        cmd_kill(_args)
        if deb:
            prefix = [] if os.geteuid() == 0 else (["sudo"] if shutil.which("sudo") else [])
            if not prefix and os.geteuid() != 0:
                die("install", "安装 deb 需要 root 或 sudo")
            run([*prefix, "apt-get", "install", "-y", str(deb)], tag="install")
            log("install", f"已安装：{deb.name}")
            return
        # 无 deb（如 --linux-targets AppImage）：放 ~/.local/bin 并加执行位。
        dest_dir = Path.home() / ".local" / "bin"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / appimage.name  # type: ignore[union-attr]
        shutil.copy2(appimage, dest)  # type: ignore[union-attr]
        dest.chmod(0o755)
        log("install", f"已安装 AppImage：{dest}（命令行直接执行文件名即可启动）")
        return
    # Windows：NSIS 静默安装（/S）。默认每用户安装，无需管理员。
    installer = latest_desktop_artifact("*-setup.exe", "*.exe")
    if not installer:
        die("install", "未找到 NSIS 安装包（dist-desktop/*-setup.exe），请先执行 python3 build.py package")
    cmd_kill(_args)
    run(["cmd", "/c", "start", "/wait", "", str(installer), "/S"], tag="install")
    log("install", f"已静默安装：{installer.name}")


def installed_app_command() -> list[str] | None:
    if IS_MAC:
        app = Path("/Applications") / f"{APP_NAME}.app"
        return ["open", str(app)] if app.is_dir() else None
    if IS_LINUX:
        for base in (Path("/usr/share/applications"), Path.home() / ".local" / "share" / "applications"):
            if (base / "goose-note-app.desktop").is_file():
                return ["gtk-launch", "goose-note-app"]
        return None
    exe = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / APP_NAME / f"{APP_NAME}.exe"
    return [str(exe)] if exe.is_file() else None


def cmd_start(_args: argparse.Namespace) -> None:
    command = installed_app_command()
    if command is None:
        electron = ROOT / "node_modules" / ".bin" / ("electron" if not IS_WIN else "electron.cmd")
        if not electron.exists():
            die("start", "既没有安装副本，也找不到 node_modules/.bin/electron；先 build 或 install")
        command = [str(electron), "."]
        log("start", "未发现安装副本，回退开发实例。")
    log("start", f"启动：{' '.join(command)}")
    subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=not IS_WIN,
    )
