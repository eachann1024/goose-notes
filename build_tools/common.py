"""Goose Note 构建：common。"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path



APP_NAME = "Goose Note"


ROOT = Path(__file__).resolve().parent.parent


PACK_DIR = ROOT / "dist-electron" / "app-pack"


PACKAGED_DIR = ROOT / "dist-electron" / "packaged"


DESKTOP_DIR = ROOT / "dist-desktop"


PACKAGE_JSON = ROOT / "package.json"


IS_MAC = sys.platform == "darwin"


IS_WIN = sys.platform == "win32"


IS_LINUX = sys.platform.startswith("linux")


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
