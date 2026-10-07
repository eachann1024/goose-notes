import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO = process.env.GH_REPO || process.env.GITHUB_REPOSITORY || "eachann1024/goose-notes";

export function createUpdateFeed(tag, assets, hashes, repo = REPO) {
  return {
    tag_name: tag,
    html_url: `https://github.com/${repo}/releases/tag/${tag}`,
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`,
      sha256: hashes.get(name),
    })),
  };
}

export function createCask(version, tag, hashes, repo = REPO, signed = false) {
  const arm = `Goose.Note-${version}-arm64.dmg`;
  const intel = `Goose.Note-${version}.dmg`;
  assert.ok(hashes.has(arm) && hashes.has(intel), "Both macOS DMGs are required");
  return `cask "goose-note" do
  arch arm: "-arm64", intel: ""
  version "${version},${tag.slice(`v${version}-`.length)}"
  sha256 arm: "${hashes.get(arm)}",
         intel: "${hashes.get(intel)}"
  url "https://github.com/${repo}/releases/download/v#{version.csv.first}-#{version.csv.second}/Goose.Note-#{version.csv.first}#{arch}.dmg"
  name "Goose Note"
  desc "Local-first Markdown notes with AI"
  homepage "https://github.com/${repo}"
  depends_on :macos
  app "Goose Note.app"
  zap trash: [
    "~/Library/Application Support/Goose Note",
    "~/Library/Logs/Goose Note",
    "~/Library/Preferences/com.goosenote.desktop.plist",
    "~/Library/Saved Application State/com.goosenote.desktop.savedState",
  ]${signed ? "" : `
  caveats <<~EOS
    Goose Note is currently unsigned and not notarized.
    After installing, allow it in System Settings → Privacy & Security.
    If needed, run: xattr -cr "/Applications/Goose Note.app"
  EOS`}
end
`;
}

function gh(args, input) {
  return execFileSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function putFile(path, content, tag) {
  let current;
  try {
    current = JSON.parse(gh(["api", `repos/${REPO}/contents/${path}`]));
  } catch (error) {
    if (!String(error.stderr).includes("404")) throw error;
  }
  const encoded = Buffer.from(content).toString("base64");
  if (current?.content?.replace(/\s/g, "") === encoded) return;
  gh(["api", "--method", "PUT", `repos/${REPO}/contents/${path}`, "--input", "-"],
    JSON.stringify({
      message: `更新 ${tag} 下载信息`,
      content: encoded,
      ...(current?.sha ? { sha: current.sha } : {}),
    }));
}

// The only files a public Release carries: one installer per platform/arch, plus SHA256SUMS.txt.
// macOS update ZIPs are only consumed by Squirrel.Mac auto-update (updates/mac-*.json), which runs
// for signed builds only, so they are published only when both macOS builds are signed + notarized.
// Build records, notices and the source archive stay in workflow artifacts; notices are packaged in
// the app and GitHub attaches the tag's source archive to every Release.
export function releaseInstallers(version, signed) {
  return [
    `Goose.Note-${version}-arm64.dmg`,
    `Goose.Note-${version}.dmg`,
    ...(signed ? [`Goose.Note-${version}-arm64-mac.zip`, `Goose.Note-${version}-mac.zip`] : []),
    `Goose.Note-${version}-x64-setup.exe`,
    `Goose.Note-${version}-arm64-setup.exe`,
    `Goose.Note-${version}.AppImage`,
    `goose-note-app_${version}_amd64.deb`,
    `goose-note-app-${version}.pacman`,
  ];
}

export function releaseAssets(version, signed) {
  return [...releaseInstallers(version, signed), "SHA256SUMS.txt"].sort();
}

// SignPath Foundation requires a "Code signing policy" section on download/release pages.
export function codeSigningPolicy(windowsSigned) {
  return [
    "## Code signing policy",
    "",
    windowsSigned
      ? "Free code signing provided by SignPath.io, certificate by SignPath Foundation."
      : "Free code signing provided by SignPath.io, certificate by SignPath Foundation — application pending; this release is not signed yet.",
    "",
    "- Committers and reviewers: [eachann1024](https://github.com/eachann1024)",
    "- Approvers: [eachann1024](https://github.com/eachann1024)",
    `- Privacy policy: https://github.com/${REPO}/blob/main/PRIVACY.md`,
  ].join("\n");
}

// The get-release-by-tag endpoint never returns drafts, so look releases up in the full list.
export function pickRelease(lines, tag) {
  const found = lines.split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((release) => release.tag_name === tag);
  assert.ok(found.length <= 1, `Multiple releases use tag ${tag}`);
  return found[0];
}

function findRelease(tag) {
  return pickRelease(gh(["api", "--paginate", `repos/${REPO}/releases?per_page=100`, "--jq", ".[]"]), tag);
}

async function main() {
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const sha = process.env.GITHUB_SHA || gh(["api", `repos/${REPO}/commits/main`, "--jq", ".sha"]).trim();
  const tag = `v${version}-${sha.slice(0, 7)}`;
  const input = join(ROOT, "artifacts");
  const stage = mkdtempSync(join(tmpdir(), "goose-release-"));
  try {
    const signed = ["arm64", "x64"].every((arch) => {
      const build = JSON.parse(readFileSync(join(input, `goose-note-mac-${arch}-BUILD.json`), "utf8"));
      return build.signed === true && build.notarized === true;
    });
    const windowsSigned = ["arm64", "x64"].every((arch) =>
      JSON.parse(readFileSync(join(input, `goose-note-win-${arch}-BUILD.json`), "utf8")).signed === true);
    const installers = releaseInstallers(version, signed);
    const available = readdirSync(input).filter((name) => /\.(exe|dmg|zip|AppImage|deb|rpm|pacman)$/.test(name));
    const unexpected = available.filter((name) => !installers.includes(name) && !(name.endsWith(".zip") && !signed));
    assert.deepEqual(unexpected, [], `Unexpected installers would be dropped: ${unexpected.join(", ")}`);
    const hashes = new Map();
    for (const name of installers) {
      assert.ok(existsSync(join(input, name)), `Missing release installer: ${name}`);
      copyFileSync(join(input, name), join(stage, name));
      hashes.set(name, createHash("sha256").update(readFileSync(join(stage, name))).digest("hex"));
    }
    const cask = createCask(version, tag, hashes, REPO, signed);
    writeFileSync(join(stage, "SHA256SUMS.txt"), installers.map((name) => `${hashes.get(name)}  ${name}\n`).join(""));
    assert.deepEqual(readdirSync(stage).sort(), releaseAssets(version, signed));
    const notes = [
      `Goose Note ${version}，构建对应提交：${sha}`,
      "",
      "- macOS：Apple 芯片 `-arm64.dmg`，Intel `.dmg`",
      "- Windows：x64 `-x64-setup.exe`，ARM64 `-arm64-setup.exe`",
      "- Linux x64：`.AppImage`（通用）、`.deb`（Debian/Ubuntu）、`.pacman`（Arch / Omarchy 等 Arch 系：`sudo pacman -U ./goose-note-app-*.pacman`）",
      "- `SHA256SUMS.txt`：以上安装包的 SHA-256 校验值",
      "",
      `${signed ? "macOS 已签名并公证" : "macOS 未签名、未公证"}；${windowsSigned ? "Windows 安装包与主程序已由 SignPath 签名" : "Windows 未做 Authenticode 签名"}。打包检查不代替桌面功能验收。`,
      "许可证与第三方声明随安装包附带；对应源码为本 Release 下方 GitHub 自动附带的 Source code 归档，构建方法见仓库 SOURCE-CODE.md。",
      `构建记录：https://github.com/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`,
      "",
      codeSigningPolicy(windowsSigned),
    ].join("\n");
    const existing = findRelease(tag);
    if (existing && !existing.draft) {
      console.log(`${tag} is already published; keeping its assets intact.`);
      return;
    }
    if (!existing) {
      gh(["release", "create", tag, "--repo", REPO, "--target", sha,
        "--title", `Goose Note ${version}`, "--notes", notes, "--draft"]);
    }
    gh(["release", "upload", tag, "--repo", REPO, "--clobber",
      ...readdirSync(stage).map((name) => join(stage, name))]);
    const uploaded = findRelease(tag);
    assert.ok(uploaded, `Release ${tag} not found after upload`);
    assert.deepEqual(uploaded.assets.map((asset) => asset.name).sort(), releaseAssets(version, signed),
      "Release assets must match the release allowlist exactly");
    for (const [name, digest] of hashes) {
      const asset = uploaded.assets.find((item) => item.name === name);
      assert.equal(asset?.digest, `sha256:${digest}`, `Uploaded checksum mismatch: ${name}`);
    }
    gh(["release", "edit", tag, "--repo", REPO, "--draft=false", "--latest"]);
    putFile("Casks/goose-note.rb", cask, tag);
    putFile("updates/latest.json", JSON.stringify(createUpdateFeed(tag, installers, hashes)) + "\n", tag);
    if (signed) {
      for (const arch of ["arm64", "x64"]) {
        const zip = installers.find((name) => name.endsWith(".zip") && name.includes("arm64") === (arch === "arm64"));
        assert.ok(zip, `Missing ${arch} update ZIP`);
        putFile(`updates/mac-${arch}.json`, JSON.stringify({
          currentRelease: version,
          releases: [{ version, updateTo: {
            url: `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(zip)}`,
            name: version, notes: `Goose Note ${version}`, pub_date: new Date().toISOString(),
          } }],
        }) + "\n", tag);
      }
    }
    console.log(`Published and verified ${tag} in ${REPO}.`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  const hashes = new Map([["Goose.Note-1.5.8-arm64.dmg", "arm"], ["Goose.Note-1.5.8.dmg", "intel"]]);
  assert.ok(createCask("1.5.8", "v1.5.8-abcdef0", hashes).includes("eachann1024/goose-notes/releases"));
  assert.equal(createUpdateFeed("v1.5.8-abcdef0", [...hashes.keys()], hashes).assets.length, 2);
  assert.throws(() => createCask("1.5.8", "v1.5.8-abcdef0", new Map()));
  assert.ok(codeSigningPolicy(false).includes("Code signing policy") && codeSigningPolicy(false).includes("not signed yet"));
  assert.ok(!codeSigningPolicy(true).includes("pending"));
  assert.deepEqual(releaseAssets("1.5.8", false), [
    "Goose.Note-1.5.8-arm64-setup.exe", "Goose.Note-1.5.8-arm64.dmg", "Goose.Note-1.5.8-x64-setup.exe",
    "Goose.Note-1.5.8.AppImage", "Goose.Note-1.5.8.dmg", "SHA256SUMS.txt",
    "goose-note-app-1.5.8.pacman", "goose-note-app_1.5.8_amd64.deb",
  ], "Unsigned Release assets changed; update the allowlist deliberately");
  assert.deepEqual(releaseAssets("1.5.8", true).filter((name) => !releaseAssets("1.5.8", false).includes(name)),
    ["Goose.Note-1.5.8-arm64-mac.zip", "Goose.Note-1.5.8-mac.zip"], "Signed Releases add only the Squirrel.Mac ZIPs");
  const list = [{ tag_name: "v1.5.8-abcdef0", draft: true }, { tag_name: "v1.5.7-1234567", draft: false }]
    .map((release) => JSON.stringify(release)).join("\n") + "\n";
  assert.equal(pickRelease(list, "v1.5.8-abcdef0")?.draft, true, "Draft releases must be found");
  assert.equal(pickRelease(list, "v9.9.9-0000000"), undefined);
  assert.ok(!readFileSync(fileURLToPath(import.meta.url), "utf8").includes("releases/" + "tags/"),
    "get-release-by-tag misses drafts; use findRelease");
  console.log("Release feed and Homebrew cask checks passed.");
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
