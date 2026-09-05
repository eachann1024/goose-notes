import {
  readFileSync,
  readdirSync,
  existsSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const seen = new Set();
const packages = [];
const supplements = JSON.parse(
  readFileSync(join(root, "public/legal/upstream/index.json"), "utf8"),
);
function locate(name, base) {
  let dir = base;
  while (true) {
    const candidate = join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function visit(name, base, optional = false) {
  const dir = locate(name, base);
  if (!dir) {
    if (!optional) throw new Error(`Missing installed dependency: ${name}`);
    return;
  }
  if (seen.has(dir)) return;
  seen.add(dir);
  const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const files = readdirSync(dir).filter((file) =>
    /^(licen[cs]e|copying|notice)([.-]|$)/i.test(file),
  );
  const texts = files.flatMap((file) => {
    try {
      return [`${file}\n${readFileSync(join(dir, file), "utf8")}`];
    } catch {
      return [];
    }
  });
  if (!texts.length) {
    const supplement = supplements.find(
      (p) => p.name === meta.name && p.version === meta.version && p.file,
    );
    if (supplement)
      texts.push(
        `Source: ${supplement.source}\n${readFileSync(join(root, "public/legal/upstream", supplement.file), "utf8")}`,
      );
    else {
      const readme = readdirSync(dir).find((file) =>
        /^readme([.-]|$)/i.test(file),
      );
      if (readme) {
        const text = readFileSync(join(dir, readme), "utf8");
        let at = text.search(/^#{1,6}\s+(?:license|licence|copyright)/im);
        if (
          at < 0 &&
          /Permission is hereby granted|MIT License|ISC License/i.test(text)
        )
          at = 0;
        if (at >= 0)
          texts.push(`${readme} (license section)\n${text.slice(at)}`);
      }
    }
  }
  packages.push({
    name: meta.name,
    version: meta.version,
    license: meta.license ?? "See bundled license",
    repository:
      typeof meta.repository === "string"
        ? meta.repository
        : (meta.repository?.url ?? meta.homepage ?? ""),
    texts,
  });
  for (const dep of Object.keys(meta.dependencies ?? {}))
    visit(dep, dir, dep in (meta.optionalDependencies ?? {}));
  for (const dep of Object.keys(meta.optionalDependencies ?? {}))
    visit(dep, dir, true);
}
for (const name of Object.keys(pkg.dependencies)) visit(name, root);
packages.sort((a, b) =>
  `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
);
const header = `Goose Note — Copyright (c) 2026 eachann and contributors\nProject: https://github.com/eachann1024/goose-notes\nCurrent project license: GPL-3.0-only (see LICENSE).\nNo warranty. Third-party portions retain their original notices and licenses.\nThis inventory includes installed production dependencies and their dependency declarations; not every entry is necessarily included in every build.\nBlockNote XL is used under its GPLv3 option, not a commercial license.\nBlockNote core/react/mantine retain MPL-2.0; obtain exact-version source and any modifications with the corresponding-source distribution.\nDOMPurify: Apache-2.0 option. JSZip: MIT option.\n\nHistorical source and contributions\nGoose Note historical MIT: Copyright (c) 2026 eachann.\nMarkdown Preview: https://github.com/pluk-inc/markdown-preview\nCopyright (c) 2026 Pluk. Original MIT notice retained below.\nGit history preserves contributor attribution, including Fauzaan and xdd666 / 小呆呆666; this notice does not transfer their copyright.\nHistorical MIT grants and independent third-party grants remain available on their original terms.\n\n`;
const historical = ["Goose-Note-historical-MIT.txt", "Markdown-Preview-MIT.txt"]
  .map(
    (file) =>
      `${file}\n${readFileSync(join(root, "public/legal", file), "utf8")}`,
  )
  .join("\n\n");
const uniquePackages = [
  ...new Map(packages.map((p) => [p.name + "@" + p.version, p])).values(),
];
const body = uniquePackages
  .map(
    (p) =>
      `\n${"=".repeat(72)}\n${p.name} ${p.version}\nDeclared license: ${typeof p.license === "string" ? p.license : JSON.stringify(p.license)}\nSource: ${p.repository}\n\n${p.texts.join("\n\n") || "This installed package has no top-level license text. Refer to the declared license and source distribution; verify its notices before distributing this component."}`,
  )
  .join("\n");
writeFileSync(
  join(root, "THIRD-PARTY-NOTICES.txt"),
  (header + historical + body).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n",
);
const missing = uniquePackages
  .filter((p) => !p.texts.length)
  .map((p) => ({ name: p.name, version: p.version, repository: p.repository }));
console.log(
  JSON.stringify(
    { packages: uniquePackages.length, withoutTopLevelLicenseText: missing },
    null,
    2,
  ),
);
