export function fittingBreadcrumb(parts: string[], width: number, measure: (part: string, root: boolean) => number): number[] {
  if (!parts.length || measure(parts.at(-1)!, parts.length === 1) > width) return [];
  const visible = [parts.length - 1];
  const fits = (indices: number[]) => indices.reduce((sum, index, position) =>
    sum + measure(parts[index], index === 0) + (position ? measure("›", false) + 10 : 0), 0) <= width;
  for (let index = parts.length - 2; index >= 0; index--) {
    if (fits([index, ...visible])) visible.unshift(index);
    else break;
  }
  return visible;
}
