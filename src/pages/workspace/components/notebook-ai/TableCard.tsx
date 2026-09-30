/**
 * showTable 工具的输出渲染卡片
 */
interface TableCardProps {
  title?: string;
  columns: string[];
  rows: string[][];
}

export function TableCard({ title, columns, rows }: TableCardProps) {
  return (
    <div className="my-2 overflow-hidden rounded-[8px] border border-border">
      {title && (
        <div className="border-b border-border bg-[var(--goose-interactive-hover)] px-3 py-2 text-xs font-medium text-foreground">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-[var(--goose-interactive-hover)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border last:border-0 hover:bg-[var(--goose-interactive-hover)] transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
