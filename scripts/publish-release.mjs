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
import { basename, join, resolve } from "node:path";
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
    const hashes = new Map();
    for (const name of readdirSync(input).sort()) {
      if (name.endsWith("SHA256SUMS.txt")) continue;
      const target = join(stage, name.replaceAll(" ", "."));
      assert.ok(!existsSync(target), `Duplicate release file: ${basename(target)}`);
      copyFileSync(join(input, name), target);
      hashes.set(basename(target), createHash("sha256").update(readFileSync(target)).digest("hex"));
    }
    const names = [...hashes.keys()];
    assert.ok(names.some((name) => name.endsWith(".exe")), "Missing Windows installer");
    assert.ok(names.some((name) => name.endsWith(".AppImage")), "Missing Linux installer");
    assert.ok(names.some((name) => name.endsWith(`source-${sha}.tar.gz`)), "Missing matching source archive");
    const signed = ["arm64", "x64"].every((arch) => {
      const build = JSON.parse(readFileSync(join(input, `goose-note-mac-${arch}-BUILD.json`), "utf8"));
      return build.signed === true && build.notarized === true;
    });
    const cask = createCask(version, tag, hashes, REPO, signed);
    writeFileSync(join(stage, "SHA256SUMS.txt"), names.map((name) => `${hashes.get(name)}  ${name}\n`).join(""));
    const notes = [
      `Goose Note ${version}，构建对应提交：${sha}`,
      "",
      "Windows x64：exe；macOS：Apple Silicon arm64.dmg / Intel dmg；Linux x64：AppImage / deb / rpm / pacman。",
      "附对应源码、构建记录、第三方声明和 SHA256SUMS.txt。",
      "签名与公证状态见各平台 BUILD.json；打包检查不代替桌面功能验收。",
      `构建记录：https://github.com/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`,
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
    for (const [name, digest] of hashes) {
      const asset = uploaded.assets.find((item) => item.name === name);
      assert.equal(asset?.digest, `sha256:${digest}`, `Uploaded checksum mismatch: ${name}`);
    }
    gh(["release", "edit", tag, "--repo", REPO, "--draft=false", "--latest"]);
    putFile("Casks/goose-note.rb", cask, tag);
    const installers = names.filter((name) => /\.(exe|dmg|zip|AppImage|deb|rpm|pacman)$/.test(name));
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
