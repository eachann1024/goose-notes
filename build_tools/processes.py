"""Goose Note 构建：processes。"""

from __future__ import annotations

import argparse
import csv
import os
import re
import signal
import subprocess
import time
from pathlib import Path
from .common import (ROOT, IS_MAC, IS_WIN, IS_LINUX, INSTALL_BIN_MAC, INSTALL_BIN_WIN, INSTALL_BIN_LINUX, KILL_GRACE_SECONDS, log, die)


def find_installed_pids() -> list[int]:
    """安装版进程。linux 用 pgrep -x（binary 名固定）；mac/win 匹配命令行。"""
    pids: list[int] = []
    try:
        if IS_LINUX:
            out = subprocess.run(
                ["pgrep", "-x", INSTALL_BIN_LINUX],
                capture_output=True,
                text=True,
            ).stdout
            pids.extend(int(line) for line in out.split() if line.isdigit())
        elif IS_MAC:
            out = subprocess.run(
                ["pgrep", "-f", INSTALL_BIN_MAC],
                capture_output=True,
                text=True,
            ).stdout
            pids.extend(int(line) for line in out.split() if line.isdigit())
        else:
            # Windows：按镜像名查，tasklist 输出首行为表头。
            out = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {INSTALL_BIN_WIN}", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
            ).stdout
            for line in out.splitlines():
                fields = [f.strip('"') for f in line.split('","')]
                if len(fields) >= 2 and fields[0] == INSTALL_BIN_WIN and fields[1].isdigit():
                    pids.append(int(fields[1]))
    except OSError:
        pass
    return sorted(set(pids))


def find_dev_pids() -> list[int]:
    """开发实例：命令行里带本仓库 node_modules/electron 的进程。"""
    marker = str(ROOT / "node_modules" / "electron")
    exclude = {os.getpid(), os.getppid()}
    pids: list[int] = []
    try:
        if IS_LINUX or IS_MAC:
            out = subprocess.run(
                ["pgrep", "-f", re.escape(marker)],
                capture_output=True,
                text=True,
            ).stdout
            for line in out.split():
                if not line.isdigit():
                    continue
                pid = int(line)
                # 防自杀：跳过本脚本及其父进程（命令行可能带 marker 字符串）。
                if pid in exclude:
                    continue
                # /proc 仅在 Linux 可用；无法确认所属仓库时不终止该进程。
                if IS_LINUX:
                    try:
                        if b"--type=" in Path(f"/proc/{pid}/cmdline").read_bytes():
                            continue
                        if Path(f"/proc/{pid}/cwd").resolve(strict=True) != ROOT:
                            continue
                    except OSError:
                        continue
                else:
                    try:
                        command = subprocess.run(
                            ["ps", "-p", str(pid), "-o", "command="],
                            capture_output=True,
                            text=True,
                        ).stdout
                    except OSError:
                        continue
                    if marker not in command or "--type=" in command:
                        continue
                pids.append(pid)
        else:
            query = (
                "Get-CimInstance Win32_Process | Where-Object "
                f"{{ $_.CommandLine -like '*{marker}*' }} "
                "| Select-Object -ExpandProperty ProcessId"
            )
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command", query],
                capture_output=True,
                text=True,
            ).stdout
            pids.extend(
                int(line)
                for line in out.split()
                if line.isdigit() and int(line) not in exclude
            )
    except OSError:
        pass
    return sorted(set(pids))


def signal_pids(pids: list[int], sig: int) -> None:
    for pid in pids:
        try:
            if IS_WIN:
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid), "/T"],
                    capture_output=True,
                    check=True,
                )
            else:
                os.kill(pid, sig)
        except subprocess.CalledProcessError as error:
            # /T 可能已随父进程结束了其它目标；仅在 PID 仍存活时判定失败。
            if IS_WIN and not alive_pids([pid]):
                continue
            die("kill", f"终止 PID {pid} 失败（退出码 {error.returncode}）")
        except (ProcessLookupError, PermissionError, OSError) as error:
            if IS_WIN:
                die("kill", f"终止 PID {pid} 失败：{error}")
            pass


def alive_pids(pids: list[int]) -> list[int]:
    """还存活的 PID；Windows 查询失败时保守视为存活。"""
    if IS_WIN:
        alive: list[int] = []
        for pid in pids:
            try:
                result = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
            except (OSError, subprocess.CalledProcessError):
                alive.append(pid)
                continue
            if any(len(row) >= 2 and row[1] == str(pid) for row in csv.reader(result.stdout.splitlines())):
                alive.append(pid)
        return alive
    alive: list[int] = []
    for pid in pids:
        try:
            os.kill(pid, 0)  # 信号 0 只探测不发送。
            alive.append(pid)
        except ProcessLookupError:
            continue
        except PermissionError:
            alive.append(pid)  # 进程存在但归属他人。
    return alive


def cmd_kill(_args: argparse.Namespace) -> None:
    targets = {"installed": find_installed_pids(), "dev": find_dev_pids()}
    total = sum(len(v) for v in targets.values())
    if total == 0:
        log("kill", "没有正在运行的 Goose Note。")
        return
    for kind, pids in targets.items():
        if pids:
            log("kill", f"{kind} 实例 PID: {', '.join(map(str, pids))}")
    merged = sorted({pid for pids in targets.values() for pid in pids})
    signal_pids(merged, signal.SIGTERM)
    if IS_WIN:
        # taskkill /F 已在 signal_pids 内执行。
        log("kill", f"已强制终止 {len(merged)} 个进程。")
        return
    deadline = time.monotonic() + KILL_GRACE_SECONDS
    while time.monotonic() < deadline:
        if not alive_pids(merged):
            log("kill", "旧实例已退出。")
            return
        time.sleep(0.5)
    log("kill", "宽限期内未退出，SIGKILL 强杀…")
    signal_pids(merged, signal.SIGKILL)
    time.sleep(1)
    remaining = alive_pids(merged)
    if remaining:
        die("kill", f"仍有进程未退出：{', '.join(map(str, remaining))}，停止后续打包或安装")
    log("kill", "旧实例已强制退出。")
