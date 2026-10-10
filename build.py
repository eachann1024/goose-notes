#!/usr/bin/env python3
"""Goose Note 跨平台构建脚本。

参考 1Panel build.py 的单入口子命令思路：一个脚本覆盖
强杀、编译、打包、安装、启动、发布全流程，macOS / Windows / Linux 通用。

用法:
    python3 build.py <命令> [选项]

命令:
    kill      强杀正在运行的 Goose Note（安装版与开发实例，先 TERM 后 KILL）
    build     安装依赖并编译（renderer + main/preload + app-pack）
    package   强杀旧实例并打包平台安装包到 dist-desktop/
    install   把最新打包产物安装到本机（mac: /Applications；linux: deb/AppImage；win: NSIS 静默）
    start     启动应用（优先安装副本，回退开发目录 electron .）
    release   发布 GitHub Release（读取 artifacts/，需 gh 已登录）
    all       build → package → install 一条龙
    clean     清理 dist-electron/ 与 dist-desktop/
    status    查看运行进程与产物状态

示例:
    python3 build.py all            # 本地自用：编译打包并安装
    python3 build.py build --no-install
    python3 build.py package --linux-targets AppImage,deb
"""

from __future__ import annotations

import argparse
from build_tools.processes import (cmd_kill)
from build_tools.packaging import (cmd_build, cmd_package)
from build_tools.installation import (cmd_install, cmd_start)
from build_tools.maintenance import (cmd_release, cmd_clean, cmd_status)


COMMANDS: dict[str, tuple] = {
    "kill": (cmd_kill, "强杀正在运行的 Goose Note"),
    "build": (cmd_build, "安装依赖并编译"),
    "package": (cmd_package, "强杀旧实例并打包平台安装包"),
    "install": (cmd_install, "安装最新打包产物到本机"),
    "start": (cmd_start, "启动应用（安装副本优先）"),
    "release": (cmd_release, "发布 GitHub Release"),
    "all": (None, "build → package → install"),
    "clean": (cmd_clean, "清理构建产物目录"),
    "status": (cmd_status, "查看进程与产物状态"),
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Goose Note 跨平台构建脚本")
    parser.add_argument("command", choices=sorted(COMMANDS), help="要执行的命令")
    parser.add_argument("--no-install", action="store_true", help="build 跳过 bun install")
    parser.add_argument(
        "--linux-targets",
        metavar="LIST",
        default=None,
        help="linux 打包目标（逗号分隔，如 AppImage,deb），默认用 electron-builder.yml 全目标",
    )
    args = parser.parse_args()

    if args.command == "all":
        for step in (cmd_build, cmd_package, cmd_install):
            step(args)
        cmd_start(args)
        return 0
    COMMANDS[args.command][0](args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
