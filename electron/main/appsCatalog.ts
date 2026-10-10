import path from "node:path";

export type AppKind = "editor" | "file-manager" | "terminal";

export type AppProbe = {
  name: string;
  aliases?: string[];
  commands?: string[];
  winPaths?: string[];
  kind: AppKind;
};

export function envPath(name: string): string {
  return process.env[name] ?? "";
}

export function windowsProbes(): AppProbe[] {
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
      name: "WezTerm",
      commands: ["wezterm"],
      winPaths: [
        path.join(programs, "WezTerm", "wezterm.exe"),
        path.join(local, "Programs", "WezTerm", "wezterm.exe"),
      ],
      kind: "terminal",
    },
    {
      name: "Command Prompt",
      aliases: ["cmd", "命令提示符"],
      commands: ["cmd"],
      winPaths: [
        envPath("ComSpec") || path.join(systemRoot, "System32", "cmd.exe"),
      ],
      kind: "terminal",
    },
    {
      name: "PowerShell",
      commands: ["powershell", "pwsh"],
      kind: "terminal",
    },
  ];
}

export function linuxProbes(): AppProbe[] {
  return [
    {
      name: "Files",
      aliases: ["Nautilus", "文件"],
      commands: ["nautilus", "gio"],
      kind: "file-manager",
    },
    { name: "Dolphin", commands: ["dolphin"], kind: "file-manager" },
    { name: "Nemo", commands: ["nemo"], kind: "file-manager" },
    { name: "Thunar", commands: ["thunar"], kind: "file-manager" },
    { name: "PCManFM", commands: ["pcmanfm"], kind: "file-manager" },
    {
      name: "Visual Studio Code",
      aliases: ["Code"],
      commands: ["code"],
      kind: "editor",
    },
    { name: "Cursor", commands: ["cursor"], kind: "editor" },
    { name: "Typora", commands: ["typora"], kind: "editor" },
    { name: "Obsidian", commands: ["obsidian"], kind: "editor" },
    { name: "GNOME Terminal", commands: ["gnome-terminal"], kind: "terminal" },
    { name: "Konsole", commands: ["konsole"], kind: "terminal" },
    { name: "Alacritty", commands: ["alacritty"], kind: "terminal" },
    { name: "Kitty", commands: ["kitty"], kind: "terminal" },
    { name: "WezTerm", commands: ["wezterm"], kind: "terminal" },
    {
      name: "x-terminal-emulator",
      commands: ["x-terminal-emulator"],
      kind: "terminal",
    },
  ];
}
