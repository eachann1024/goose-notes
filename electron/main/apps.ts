import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type OpenApp = { name: string; path: string };

type AppKind = "editor" | "file-manager" | "terminal";

type AppProbe = {
  name: string;
  aliases?: string[];
  commands?: string[];
  winPaths?: string[];
  kind: AppKind;
};

function envPath(name: string): string {
  return process.env[name] ?? "";
}

function windowsProbes(): AppProbe[] {
  const local = envPath("LOCALAPPDATA");
  const programs = envPath("ProgramFiles");
  const programsX86 = envPath("ProgramFiles(x86)");
  const systemRoot = envPath("SystemRoot") || "C:\\Windows";
  return [
    {
      name: "Explorer",
      aliases: ["explorer", "资源管理器"],
      commands: ["explorer"],
      winPaths: [path.join(systemRoot, "explorer.exe")],
      kind: "file-manager",
    },
    {
      name: "Notepad",
      commands: ["notepad"],
      winPaths: [path.join(systemRoot, "System32", "notepad.exe")],
      kind: "editor",
    },
    {
      name: "Notepad++",
      commands: ["notepad++"],
      winPaths: [
        path.join(programs, "Notepad++", "notepad++.exe"),
        path.join(programsX86, "Notepad++", "notepad++.exe"),
      ],
      kind: "editor",
    },
    {
      name: "Visual Studio Code",
      aliases: ["Code", "VS Code"],
      commands: ["code"],
      winPaths: [path.join(local, "Programs", "Microsoft VS Code", "Code.exe")],
      kind: "editor",
    },
    {
      name: "Cursor",
      commands: ["cursor"],
      winPaths: [path.join(local, "Programs", "cursor", "Cursor.exe")],
      kind: "editor",
    },
    {
      name: "Typora",
      commands: ["typora"],
      winPaths: [path.join(local, "Programs", "Typora", "Typora.exe")],
      kind: "editor",
    },
    {
      name: "Obsidian",
      commands: ["obsidian"],
      winPaths: [path.join(local, "Obsidian", "Obsidian.exe")],
      kind: "editor",
    },
    {
      name: "Windows Terminal",
      aliases: ["wt"],
      commands: ["wt"],
      kind: "terminal",
    },
    {
      name: "Command Prompt",
      aliases: ["cmd", "命令提示符"],
      commands: ["cmd"],
      winPaths: [envPath("ComSpec") || path.join(systemRoot, "System32", "cmd.exe")],
      kind: "terminal",
    },
    {
      name: "PowerShell",
      commands: ["powershell", "pwsh"],
      kind: "terminal",
    },
  ];
}

function linuxProbes(): AppProbe[] {
  return [
    { name: "Files", aliases: ["Nautilus", "文件"], commands: ["nautilus", "gio"], kind: "file-manager" },
    { name: "Dolphin", commands: ["dolphin"], kind: "file-manager" },
    { name: "Nemo", commands: ["nemo"], kind: "file-manager" },
    { name: "Thunar", commands: ["thunar"], kind: "file-manager" },
    { name: "PCManFM", commands: ["pcmanfm"], kind: "file-manager" },
    { name: "Visual Studio Code", aliases: ["Code"], commands: ["code"], kind: "editor" },
    { name: "Cursor", commands: ["cursor"], kind: "editor" },
    { name: "Typora", commands: ["typora"], kind: "editor" },
    { name: "Obsidian", commands: ["obsidian"], kind: "editor" },
    { name: "GNOME Terminal", commands: ["gnome-terminal"], kind: "terminal" },
    { name: "Konsole", commands: ["konsole"], kind: "terminal" },
    { name: "Alacritty", commands: ["alacritty"], kind: "terminal" },
    { name: "Kitty", commands: ["kitty"], kind: "terminal" },
    { name: "WezTerm", commands: ["wezterm"], kind: "terminal" },
    { name: "x-terminal-emulator", commands: ["x-terminal-emulator"], kind: "terminal" },
  ];
}

function macApplicationRoots(): string[] {
  return ["/Applications", path.join(homedir(), "Applications")];
}

function spawnDetached(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function resolveCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;
  if (existsSync(trimmed)) return trimmed;
  try {
    if (process.platform === "win32") {
      const out = execFileSync("where", [trimmed], {
        encoding: "utf8",
        timeout: 2000,
        windowsHide: true,
      }).trim();
      return out.split(/\r?\n/).find(Boolean) ?? null;
    }
    const out = execFileSync("which", [trimmed], {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function firstExisting(paths: string[] | undefined): string | null {
  if (!paths) return null;
  return paths.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function normalizeMatch(value: string): string {
  return value.trim().replace(/\.app$/i, "").replace(/\.exe$/i, "").toLowerCase();
}

async function listMacApps(): Promise<OpenApp[]> {
  const found = new Map<string, OpenApp>();
  for (const root of macApplicationRoots()) {
    if (!existsSync(root)) continue;
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      const appPath = path.join(root, entry);
      const name = entry.replace(/\.app$/i, "");
      if (!found.has(name.toLowerCase())) {
        found.set(name.toLowerCase(), { name, path: appPath });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function listProbedApps(probes: AppProbe[]): OpenApp[] {
  const found = new Map<string, OpenApp>();
  for (const probe of probes) {
    const resolved =
      firstExisting(probe.winPaths) ??
      (probe.commands ?? []).map(resolveCommand).find((value): value is string => Boolean(value)) ??
      null;
    if (!resolved) continue;
    const key = probe.name.toLowerCase();
    if (!found.has(key)) found.set(key, { name: probe.name, path: resolved });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listOpenApps(): Promise<OpenApp[]> {
  if (process.platform === "darwin") return listMacApps();
  if (process.platform === "win32") return listProbedApps(windowsProbes());
  return listProbedApps(linuxProbes());
}

function parseAppInvocation(app: string): { command: string; extraArgs: string[] } {
  const trimmed = app.trim();
  if (existsSync(trimmed)) return { command: trimmed, extraArgs: [] };
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [trimmed];
  const command = (parts[0] ?? trimmed).replace(/^"|"$/g, "");
  const extraArgs = parts.slice(1).map((part) => part.replace(/^"|"$/g, ""));
  return { command, extraArgs };
}

function catalogForPlatform(): AppProbe[] {
  if (process.platform === "win32") return windowsProbes();
  if (process.platform === "linux") return linuxProbes();
  return [];
}

function matchProbe(app: string): AppProbe | null {
  const token = normalizeMatch(app);
  const basename = normalizeMatch(path.basename(app));
  for (const probe of catalogForPlatform()) {
    const names = [probe.name, ...(probe.aliases ?? []), ...(probe.commands ?? [])].map(normalizeMatch);
    if (names.includes(token) || names.includes(basename)) return probe;
  }
  return null;
}

function openWithDefault(targetPath: string): boolean {
  if (process.platform === "darwin") {
    return spawnDetached("/usr/bin/open", [targetPath]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "", targetPath]);
  }
  return spawnDetached("xdg-open", [targetPath]);
}

function openWithExplorer(targetPath: string): boolean {
  try {
    const info = statSync(targetPath);
    if (info.isDirectory()) return spawnDetached("explorer", [targetPath]);
  } catch {
    // fall through to select
  }
  return spawnDetached("explorer", [`/select,${targetPath}`]);
}

export function openWithApp(app: string, targetPath: string): boolean {
  if (!targetPath) return false;
  const appName = app.trim();
  if (!appName) return openWithDefault(targetPath);

  if (process.platform === "darwin") {
    const invocation = parseAppInvocation(appName);
    if (existsSync(invocation.command) && !invocation.command.endsWith(".app")) {
      return spawnDetached(invocation.command, [...invocation.extraArgs, targetPath]);
    }
    return spawnDetached("/usr/bin/open", ["-a", invocation.command, ...invocation.extraArgs, targetPath]);
  }

  const probe = matchProbe(appName);
  if (probe?.kind === "file-manager" && process.platform === "win32") {
    return openWithExplorer(targetPath);
  }
  if (probe?.commands?.includes("gio") && process.platform === "linux") {
    const gio = resolveCommand("gio");
    if (gio) return spawnDetached(gio, ["open", targetPath]);
  }

  const invocation = parseAppInvocation(appName);
  const resolved =
    (existsSync(invocation.command) ? invocation.command : null) ??
    firstExisting(probe?.winPaths) ??
    resolveCommand(invocation.command) ??
    (probe?.commands ?? []).map(resolveCommand).find((value): value is string => Boolean(value)) ??
    null;
  if (!resolved) return openWithDefault(targetPath);
  return spawnDetached(resolved, [...invocation.extraArgs, targetPath]);
}

function resolveDirectoryTarget(targetPath: string): string {
  try {
    const info = statSync(targetPath);
    if (info.isDirectory()) return targetPath;
    return path.dirname(targetPath);
  } catch {
    return targetPath;
  }
}

function openDefaultTerminal(dir: string): boolean {
  if (process.platform === "darwin") {
    const iterm = "/Applications/iTerm.app";
    if (existsSync(iterm)) {
      return spawnDetached("/usr/bin/open", ["-a", "iTerm", dir]);
    }
    return spawnDetached("/usr/bin/open", ["-a", "Terminal", dir]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "cmd", "/k", `cd /d "${dir}"`]);
  }
  return spawnDetached("x-terminal-emulator", ["--working-directory", dir]);
}

function openNamedTerminal(terminal: string, dir: string): boolean {
  const token = normalizeMatch(terminal);
  if (process.platform === "darwin") {
    return spawnDetached("/usr/bin/open", ["-a", parseAppInvocation(terminal).command, dir]);
  }
  if (process.platform === "win32") {
    if (token.includes("windows terminal") || token === "wt") {
      const wt = resolveCommand("wt");
      if (wt) return spawnDetached(wt, ["-d", dir]);
    }
    if (token.includes("powershell") || token === "pwsh") {
      const shellPath = resolveCommand(token === "pwsh" ? "pwsh" : "powershell");
      if (shellPath) {
        return spawnDetached(shellPath, [
          "-NoExit",
          "-Command",
          `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'`,
        ]);
      }
    }
    return spawnDetached("cmd", ["/c", "start", "cmd", "/k", `cd /d "${dir}"`]);
  }
  const invocation = parseAppInvocation(terminal);
  const resolved = resolveCommand(invocation.command);
  if (!resolved) return openDefaultTerminal(dir);
  if (normalizeMatch(invocation.command).includes("gnome-terminal")) {
    return spawnDetached(resolved, [`--working-directory=${dir}`]);
  }
  if (normalizeMatch(invocation.command) === "konsole") {
    return spawnDetached(resolved, ["--workdir", dir]);
  }
  if (normalizeMatch(invocation.command) === "wezterm") {
    return spawnDetached(resolved, ["start", "--cwd", dir]);
  }
  return spawnDetached(resolved, ["--working-directory", dir]);
}

export function openTerminalAtPath(targetPath: string, terminal?: string): boolean {
  if (!targetPath) return false;
  const dir = resolveDirectoryTarget(targetPath);
  const named = terminal?.trim();
  if (!named) return openDefaultTerminal(dir);
  return openNamedTerminal(named, dir);
}
