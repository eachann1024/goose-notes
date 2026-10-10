/** 计算行的缩进空格数（tab 记 2） */
export function indentLevel(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === " ") count++;
    else if (ch === "\t") count += 2;
    else break;
  }
  return count;
}


/**
 * 解析嵌套列表（bullet / ordered / checkbox 混嵌），输出 BlockNote 块格式：
 * { type: "bulletListItem"|"numberedListItem"|"checkListItem", props?, content, children? }
 *
 * 有序编号约定（与 BlockNote 一致）：仅每段连续 numbered run 的首项在编号 ≠ 1 时
 * 写 props.start；后续项编号由序列化时递增推得。
 *
 * 空行结束当前列表（loose list 的空行由外层主循环补 spacer 段落，
 * 序列化时 spacer 会把两段列表隔开，保住原文的空行）。
 */
export function parseNestedList(
  lines: string[],
  startI: number,
  baseIndent: number,
  parseInline: (t: string) => any[],
): { items: any[]; nextIndex: number } {
  const items: any[] = [];
  let i = startI;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) break; // 空行结束本层列表
    const lvl = indentLevel(line);
    if (lvl < baseIndent) break;
    if (lvl > baseIndent) {
      // 理论上子层已被 collectChildren 消耗；防御性交还外层处理，不丢行
      break;
    }

    const stripped = line.slice(lvl);

    const taskM = stripped.match(/^-\s+\[([ xX])\](?:\s+(.*))?$/);
    const orderedM = !taskM && stripped.match(/^(\d+)\.\s+(.+)$/);
    const bulletM = !taskM && !orderedM && stripped.match(/^[-*+]\s+(.+)$/);

    if (!taskM && !orderedM && !bulletM) break;

    let item: any;
    if (taskM) {
      item = {
        type: "checkListItem",
        props: { checked: taskM[1].toLowerCase() === "x" },
        content: parseInline(taskM[2] ?? ""),
      };
    } else if (orderedM) {
      const num = parseInt(orderedM[1], 10);
      item = { type: "numberedListItem", content: parseInline(orderedM[2]) };
      const prevType = items[items.length - 1]?.type;
      if (num !== 1 && prevType !== "numberedListItem") {
        item.props = { start: num };
      }
    } else {
      item = {
        type: "bulletListItem",
        content: parseInline((bulletM as RegExpMatchArray)[1]),
      };
    }
    i++;

    const sub = collectChildren(lines, i, lvl + 1, parseInline);
    if (sub.items.length) {
      item.children = sub.items;
      i = sub.nextIndex;
    }

    items.push(item);
  }

  return { items, nextIndex: i };
}

/** 收集缩进比 minIndent 更深的行作为子列表 */
function collectChildren(
  lines: string[],
  startI: number,
  minIndent: number,
  parseInline: (t: string) => any[],
): { items: any[]; nextIndex: number } {
  const i = startI;
  if (i >= lines.length || !lines[i].trim())
    return { items: [], nextIndex: startI };
  const childIndent = indentLevel(lines[i]);
  if (childIndent < minIndent) return { items: [], nextIndex: startI };
  return parseNestedList(lines, i, childIndent, parseInline);
}
