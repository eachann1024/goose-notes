export type PlanDiffLine = {
  kind: "eq" | "del" | "add";
  text: string;
};

const MAX_LCS_CELLS = 80_000;

function splitLines(value: string): string[] {
  if (!value) return [""];
  return value.split("\n");
}

function buildLcsTable(a: string[], b: string[]): Uint16Array[] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: Uint16Array[] = Array.from(
    { length: rows },
    () => new Uint16Array(cols),
  );
  for (let i = 1; i < rows; i += 1) {
    const prev = table[i - 1]!;
    const curr = table[i]!;
    const ai = a[i - 1];
    for (let j = 1; j < cols; j += 1) {
      curr[j] =
        ai === b[j - 1]
          ? (prev[j - 1]! + 1) as number
          : Math.max(prev[j]!, curr[j - 1]!);
    }
  }
  return table;
}

function fallbackReplace(a: string[], b: string[]): PlanDiffLine[] {
  const lines: PlanDiffLine[] = [];
  for (const text of a) {
    if (a.length === 1 && a[0] === "" && b.join("\n") !== "") continue;
    lines.push({ kind: "del", text });
  }
  for (const text of b) {
    if (b.length === 1 && b[0] === "" && a.join("\n") !== "") continue;
    lines.push({ kind: "add", text });
  }
  return lines.length > 0 ? lines : [{ kind: "eq", text: "" }];
}

/** 行级 LCS diff；过大时退回整段删+整段增，避免卡主线程。 */
export function diffTextLines(oldText: string, newText: string): PlanDiffLine[] {
  if (oldText === newText) {
    return splitLines(oldText).map((text) => ({ kind: "eq" as const, text }));
  }
  if (!oldText) {
    return splitLines(newText).map((text) => ({ kind: "add" as const, text }));
  }
  if (!newText) {
    return splitLines(oldText).map((text) => ({ kind: "del" as const, text }));
  }
  const a = splitLines(oldText);
  const b = splitLines(newText);
  if (a.length * b.length > MAX_LCS_CELLS) return fallbackReplace(a, b);

  const table = buildLcsTable(a, b);
  const reverse: PlanDiffLine[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      reverse.push({ kind: "eq", text: a[i - 1]! });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i]![j - 1]! >= table[i - 1]![j]!)) {
      reverse.push({ kind: "add", text: b[j - 1]! });
      j -= 1;
    } else {
      reverse.push({ kind: "del", text: a[i - 1]! });
      i -= 1;
    }
  }
  reverse.reverse();
  return reverse;
}

export function planOperationKindLabel(
  type: "create" | "edit" | "delete" | "search_replace",
): string {
  if (type === "create") return "新建";
  if (type === "delete") return "删除";
  if (type === "search_replace") return "替换";
  return "编辑";
}
