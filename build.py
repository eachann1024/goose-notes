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
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

APP_NAME = "Goose Note"
ROOT = Path(__file__).resolve().parent
PACK_DIR = ROOT / "dist-electron" / "app-pack"
PACKAGED_DIR = ROOT / "dist-electron" / "packaged"
DESKTOP_DIR = ROOT / "dist-desktop"
PACKAGE_JSON = ROOT / "package.json"

IS_MAC = sys.platform == "darwin"
IS_WIN = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")

# 安装版进程名：mac 的可执行文件、win 的 exe、linux electron-builder 产物二进制。
INSTALL_BIN_MAC = f"{APP_NAME}.app/Contents/MacOS/{APP_NAME}"
INSTALL_BIN_WIN = f"{APP_NAME}.exe"
INSTALL_BIN_LINUX = "goose-note-app"

KILL_GRACE_SECONDS = 10


def log(tag: str, message: str) -> None:
    print(f"[{tag}] {message}", flush=True)


def die(tag: str, message: str) -> "None":
    log(tag, f"失败：{message}")
    raise SystemExit(1)


def read_version() -> str:
    import json

    try:
        return json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))["version"]
    except (OSError, KeyError, ValueError):
        return "unknown"


def require_tool(name: str, hint: str) -> str:
    path = shutil.which(name)
    if not path:
        die("build", f"缺少 {name}。{hint}")
    return path


def run(cmd: list[str], *, cwd: Path | None = None, tag: str = "build") -> None:
    display = " ".join(cmd)
    log(tag, f"$ {display}" + (f"  (cwd={cwd})" if cwd else ""))
    try:
        subprocess.run(cmd, cwd=cwd, check=True)
    except subprocess.CalledProcessError as error:
        die(tag, f"命令退出码 {error.returncode}：{display}")
    except FileNotFoundError:
        die(tag, f"找不到可执行文件：{cmd[0]}")


def builder_env() -> dict[str, str]:
    env = dict(os.environ)
    bin_dir = str(ROOT / "node_modules" / ".bin")
    env["PATH"] = bin_dir + os.pathsep + env.get("PATH", "")
    # 本地一律不签名；mac 上避免自动发现证书导致弹钥匙串。
    env["CSC_IDENTITY_AUTO_DISCOVERY"] = "false"
    # electron / electron-builder 工具链（AppImage runtime、fpm 等）默认从 GitHub
    # 下载，代理网络下常超时；注入 npmmirror 镜像兜底。已设置的值优先，CI 直连
    # GitHub 更稳，不覆盖。
    if not env.get("CI"):
        env.setdefault("ELECTRON_MIRROR", "https://npmmirror.com/mirrors/electron/")
        env.setdefault(
            "ELECTRON_BUILDER_BINARIES_MIRROR",
            "https://npmmirror.com/mirrors/electron-builder-binaries/",
        )
    return env


# ---------------------------------------------------------------------------
# 进程发现与强杀
# ---------------------------------------------------------------------------


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
            die("kill", f"终止 PID {pid} 失败（退出码 {error.returncode}）")
        except (ProcessLookupError, PermissionError, OSError) as error:
            if IS_WIN:
                die("kill", f"终止 PID {pid} 失败：{error}")
            pass


def alive_pids(pids: list[int]) -> list[int]:
    """还存活的 PID。win 上 taskkill /F 即时生效，不再复查。"""
    if IS_WIN:
        return []
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


# ---------------------------------------------------------------------------
# 编译 / 打包 / 收集
# ---------------------------------------------------------------------------


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
                "提示：Linux 全目标打包需要 rpm 与 libarchive-tools"
                "（sudo apt install rpm libarchive-tools）；"
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


# ---------------------------------------------------------------------------
# 安装 / 启动
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# 发布 / 清理 / 状态
# ---------------------------------------------------------------------------


def cmd_release(_args: argparse.Namespace) -> None:
    artifacts = ROOT / "artifacts"
    if not artifacts.is_dir() or not any(artifacts.iterdir()):
        die(
            "release",
            f"{artifacts} 为空。publish-release.mjs 面向 CI 汇总的完整产物"
            "（双架构 dmg + exe + AppImage + 源码包 + BUILD.json）；"
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
