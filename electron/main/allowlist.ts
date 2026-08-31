import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOTS_FILE = "vault-roots.json";

const vaultRoots = new Set<string>();
const sessionAllowed = new Set<string>();

export function normalizePath(p: string): string {
  return path.resolve(p);
}

function rootsFilePath(): string {
  return path.join(app.getPath("userData"), ROOTS_FILE);
}

export function attachmentsRoot(): string {
  return path.join(app.getPath("userData"), "attachments");
}

export function userDataRoot(): string {
  return app.getPath("userData");
}

export function loadVaultRoots(): void {
  vaultRoots.clear();
  try {
    const raw = readFileSync(rootsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (typeof entry === "string" && entry.trim()) {
          vaultRoots.add(normalizePath(entry));
        }
      }
    }
  } catch {
    // first run or corrupt file
  }
  mkdirSync(attachmentsRoot(), { recursive: true });
}

function persistVaultRoots(): void {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(rootsFilePath(), JSON.stringify([...vaultRoots], null, 2));
}

export function addVaultRoot(p: string): string {
  const resolved = normalizePath(p);
  vaultRoots.add(resolved);
  persistVaultRoots();
  return resolved;
}

export function addSessionAllowed(p: string): string {
  const resolved = normalizePath(p);
  sessionAllowed.add(resolved);
  return resolved;
}

export function hasUnsafeSegments(p: string): boolean {
  return p.split(/[/\\]/).includes("..") || p.includes("\0");
}

function isUnder(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isAllowedPath(p: string): boolean {
  if (hasUnsafeSegments(p)) return false;
  const resolved = normalizePath(p);
  if (isUnder(attachmentsRoot(), resolved)) return true;
  if (isUnder(userDataRoot(), resolved)) return true;
  for (const root of vaultRoots) {
    if (isUnder(root, resolved)) return true;
  }
  for (const allowed of sessionAllowed) {
    if (resolved === allowed || isUnder(allowed, resolved)) return true;
  }
  return false;
}

export function assertAllowed(p: string): string {
  if (hasUnsafeSegments(p)) {
    throw new Error("路径不允许包含 ..");
  }
  const resolved = normalizePath(p);
  if (!isAllowedPath(resolved)) {
    throw new Error("路径不在允许的仓库或应用数据目录内");
  }
  return resolved;
}

export function assertAllowedOpen(p: string): string {
  return assertAllowed(p);
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

export function pathExists(p: string): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}
