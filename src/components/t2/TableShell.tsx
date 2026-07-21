// t2/TableShell — generic CSS-grid table: a header row from `columns` and
// caller-supplied rows (via TableRow), with an empty-state slot (§14, D-14C2-13).
// Column widths are fractions (`fr`) applied as a grid template. Presentational
// only — no data, no sorting logic.
import { type FC, type ReactNode } from 'react';

export interface T2Column {
  label: string;
  align?: 'left' | 'right' | 'center';
  fr?: number; // width fraction (grid `fr` unit); defaults to 1
}

const alignCls = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

const gridTemplate = (cols: T2Column[]) =>
  cols.map((c) => `${c.fr ?? 1}fr`).join(' ');

interface TableShellProps {
  columns: T2Column[];
  children?: ReactNode; // rows (TableRow)
  empty?: ReactNode; // empty-state content
  isEmpty?: boolean;
}

export const TableShell: FC<TableShellProps> = ({
  columns,
  children,
  empty,
  isEmpty = false,
}) => (
  <div className="overflow-hidden">
    <div
      className="grid gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100"
      style={{ gridTemplateColumns: gridTemplate(columns) }}
    >
      {columns.map((c, i) => (
        <div
          key={i}
          className={`text-[11px] uppercase font-semibold text-gray-400 tracking-[0.06em] ${alignCls(
            c.align,
          )}`}
        >
          {c.label}
        </div>
      ))}
    </div>
    {isEmpty ? (
      <div className="px-4 py-10 text-center text-[13.5px] text-gray-400">{empty}</div>
    ) : (
      children
    )}
  </div>
);

interface TableRowProps {
  columns: T2Column[];
  cells: ReactNode[];
  onClick?: () => void;
}

export const TableRow: FC<TableRowProps> = ({ columns, cells, onClick }) => (
  <div
    className={`grid gap-4 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 ${
      onClick ? 'cursor-pointer' : ''
    }`}
    style={{ gridTemplateColumns: gridTemplate(columns) }}
    onClick={onClick}
  >
    {cells.map((cell, i) => (
      <div
        key={i}
        className={`text-[13.5px] text-gray-700 min-w-0 ${alignCls(columns[i]?.align)}`}
      >
        {cell}
      </div>
    ))}
  </div>
);
