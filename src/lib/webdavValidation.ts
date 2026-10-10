export function normalizeBaseUrl(raw: string): string {
  let val = raw.trim();
  if (!val) throw new Error("WebDAV 地址不能为空");

  if (!/^https?:\/\//i.test(val)) {
    throw new Error("WebDAV 地址必须以 http 或 https 开头");
  }

  if (/^http:\/\//i.test(val)) {
    let host = "";
    try {
      const url = new URL(val);
      host = url.hostname.toLowerCase();
    } catch {
      const match = val.match(/^http:\/\/([^:/]+)/i);
      if (match) {
        host = match[1].toLowerCase();
      }
    }

    // 局域网私有地址和本地回环地址放行 HTTP，保障 NAS 局域网内同步的可用性（包含常见的 IPv6 本地及回环地址）
    const isLocal =
      host === "localhost" ||
      host.startsWith("127.") ||
      host === "::1" ||
      host === "[::1]" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.startsWith("[fe80:") ||
      host.startsWith("[fd") ||
      host.startsWith("[fc");

    if (!isLocal) {
      throw new Error("公网 WebDAV 服务必须使用安全的 https 连接");
    }
  }

  try {
    const url = new URL(val);
    url.search = "";
    url.hash = "";
    val = url.toString();
  } catch (e) {
    throw new Error("WebDAV 地址格式无效", { cause: e });
  }

  if (!val.endsWith("/")) {
    val += "/";
  }
  return val;
}

export function normalizeRemoteDir(raw: string): string {
  const val = raw.trim().replace(/^\/|\/$/g, "");
  if (!val) throw new Error("WebDAV 远端目录不能为空");
  if (val.includes("\\")) throw new Error("WebDAV 远端目录不能包含反斜杠");

  const parts = val.split("/");
  const cleanParts: string[] = [];
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) throw new Error("WebDAV 远端目录不能包含空路径段");

    let decoded: string;
    try {
      decoded = decodeURIComponent(clean);
    } catch (e) {
      throw new Error("WebDAV 远端目录编码无效", { cause: e });
    }

    if (decoded === "." || decoded === ".." || decoded.includes("\\")) {
      throw new Error("WebDAV 远端目录不能包含路径穿越片段");
    }
    cleanParts.push(clean);
  }
  return cleanParts.join("/");
}

export function isBackupFileName(fileName: string): boolean {
  const trimmed = fileName.trim();
  if (trimmed !== fileName || trimmed.includes("/") || trimmed.includes("\\")) {
    return false;
  }
  const backupPattern =
    /^goose-note-export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/;
  return backupPattern.test(trimmed);
}

export function formatWebdavError(error: any): string {
  const msg = String(error.message || error);
  if (
    msg.includes("AncestorsNotFound") ||
    msg.includes("The ancestors of this location does not found")
  ) {
    return "检测到上级目录不存在，请确认“远端目录”填写的是服务端已经存在的路径。部分 WebDAV 服务不支持直接在根目录创建文件夹，例如 Nextcloud、ownCloud、坚果云或部分 NAS 场景通常需要先在服务端创建同步目录，再在这里填写对应路径（如“backups/goose-note-app”）。";
  }
  return msg;
}

export async function ensureRemoteDir(
  client: any,
  remoteDir: string,
): Promise<void> {
  const dirClean = normalizeRemoteDir(remoteDir);
  const parts = dirClean.split("/");
  let currentPath = "";
  for (const part of parts) {
    if (!part) continue;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    try {
      const exists = await client.exists(currentPath);
      if (!exists) {
        await client.createDirectory(currentPath);
      }
    } catch (err: any) {
      if (err.status === 405 || err.response?.status === 405) {
        continue;
      }
      throw err;
    }
  }
}
