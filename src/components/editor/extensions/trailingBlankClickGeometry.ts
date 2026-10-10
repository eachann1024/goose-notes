export const TRAILING_BLANK_CLICK_SLOP_PX = 2;

export type CaretCoords = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function isClickPastTextRight(
  clientX: number,
  textRight: number,
  slop = TRAILING_BLANK_CLICK_SLOP_PX,
): boolean {
  return clientX > textRight + slop;
}

export function isClickOnVisualLine(
  clientY: number,
  lineTop: number,
  lineBottom: number,
  slop = TRAILING_BLANK_CLICK_SLOP_PX,
): boolean {
  return clientY >= lineTop - slop && clientY <= lineBottom + slop;
}

function wrappedToNextLine(curr: CaretCoords, next: CaretCoords): boolean {
  return next.top >= curr.bottom - 1 && next.left < curr.left;
}

/** 从 `from` 沿同一视觉行走到最后一个文档位置。 */
export function extendToVisualLineEnd(
  coordsAtPos: (pos: number) => CaretCoords,
  from: number,
  textblockEnd: number,
): number {
  let pos = from;
  while (pos < textblockEnd) {
    let curr: CaretCoords;
    let next: CaretCoords;
    try {
      curr = coordsAtPos(pos);
      next = coordsAtPos(pos + 1);
    } catch {
      break;
    }
    if (wrappedToNextLine(curr, next)) break;
    pos += 1;
  }
  return pos;
}

/** 从 `from` 沿同一视觉行走到第一个文档位置。 */
export function extendToVisualLineStart(
  coordsAtPos: (pos: number) => CaretCoords,
  from: number,
  textblockStart: number,
): number {
  let pos = from;
  while (pos > textblockStart) {
    let curr: CaretCoords;
    let prev: CaretCoords;
    try {
      curr = coordsAtPos(pos);
      prev = coordsAtPos(pos - 1);
    } catch {
      break;
    }
    if (wrappedToNextLine(prev, curr)) break;
    pos -= 1;
  }
  return pos;
}

/** 二分找到 `clientY` 所在视觉行上的一个文档位置。 */
export function findPosOnVisualLine(
  coordsAtPos: (pos: number) => CaretCoords,
  start: number,
  end: number,
  clientY: number,
): number | null {
  let lo = start;
  let hi = end;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let coords: CaretCoords;
    try {
      coords = coordsAtPos(mid);
    } catch {
      return null;
    }
    if (clientY < coords.top - TRAILING_BLANK_CLICK_SLOP_PX) {
      hi = mid - 1;
    } else if (clientY > coords.bottom + TRAILING_BLANK_CLICK_SLOP_PX) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return null;
}

/** 行高留白 / 折行缝里取离 `clientY` 最近的视觉行。 */
function findNearestPosOnVisualLine(
  coordsAtPos: (pos: number) => CaretCoords,
  start: number,
  end: number,
  clientY: number,
): number | null {
  const exact = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (exact != null) return exact;

  let lo = start;
  let hi = end;
  let best: number | null = null;
  let bestDist = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let coords: CaretCoords;
    try {
      coords = coordsAtPos(mid);
    } catch {
      return best;
    }
    let dist = 0;
    if (clientY < coords.top) dist = coords.top - clientY;
    else if (clientY > coords.bottom) dist = clientY - coords.bottom;
    if (dist < bestDist) {
      bestDist = dist;
      best = mid;
    }
    if (clientY < coords.top) hi = mid - 1;
    else if (clientY > coords.bottom) lo = mid + 1;
    else return mid;
  }
  return best;
}

export function resolveLineEndIfClickPastText(args: {
  clientX: number;
  clientY: number;
  start: number;
  end: number;
  coordsAtPos: (pos: number) => CaretCoords;
}): number | null {
  const { clientX, clientY, start, end, coordsAtPos } = args;
  if (start === end) return null;

  const onLine = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (onLine == null) return null;

  const lineEnd = extendToVisualLineEnd(coordsAtPos, onLine, end);
  let endCoords: CaretCoords;
  try {
    endCoords = coordsAtPos(lineEnd);
  } catch {
    return null;
  }

  if (!isClickOnVisualLine(clientY, endCoords.top, endCoords.bottom)) {
    if (lineEnd === start) return null;
    try {
      endCoords = coordsAtPos(lineEnd - 1);
    } catch {
      return null;
    }
    if (!isClickOnVisualLine(clientY, endCoords.top, endCoords.bottom)) {
      return null;
    }
  }

  if (!isClickPastTextRight(clientX, endCoords.right)) return null;
  return lineEnd;
}

/** 点在字上不改；点行尾空白或块间/块内 padding 空隙则落到最近一行行尾。 */
export function resolveBlockEmptyClickPos(args: {
  clientX: number;
  clientY: number;
  start: number;
  end: number;
  coordsAtPos: (pos: number) => CaretCoords;
}): number | null {
  const { clientY, start, end, coordsAtPos } = args;
  if (start === end) return start;

  const onLine = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (onLine != null) return resolveLineEndIfClickPastText(args);

  try {
    const first = coordsAtPos(start);
    if (clientY < first.top) {
      return extendToVisualLineEnd(coordsAtPos, start, end);
    }
    const last = coordsAtPos(end);
    if (clientY > last.bottom) {
      return end;
    }
  } catch {
    return null;
  }

  // 文字垂直范围内但没贴到 caret 带：行高留白 / 折行缝。
  // 按最近视觉行处理，不要当成块间空隙拽到段尾。
  const nearest = findNearestPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (nearest == null) return null;
  try {
    const coords = coordsAtPos(nearest);
    return resolveLineEndIfClickPastText({
      ...args,
      clientY: (coords.top + coords.bottom) / 2,
    });
  } catch {
    return null;
  }
}
