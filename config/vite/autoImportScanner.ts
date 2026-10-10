import path from "node:path";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { scanDirExports, type Import } from "unimport";

/** unimport 会忽略混合 export 列表中的 type 项；补回公开入口原有类型。 */
export async function scanPublicImports(
  entries: string[],
  root: string,
): Promise<Import[]> {
  const imports = await scanDirExports(entries, { cwd: root });
  const known = new Set(
    imports.map((item) => `${item.from}:${item.name}:${Boolean(item.type)}`),
  );
  for (const entry of entries) {
    const from = path.resolve(root, entry);
    const source = ts.createSourceFile(
      from,
      await readFile(from, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (
        !ts.isExportDeclaration(statement) ||
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      )
        continue;
      for (const item of statement.exportClause.elements) {
        if (!statement.isTypeOnly && !item.isTypeOnly) continue;
        const name = item.name.text;
        const key = `${from}:${name}:true`;
        if (known.has(key)) continue;
        known.add(key);
        imports.push({ from, name, as: name, type: true });
      }
    }
  }
  return imports;
}
