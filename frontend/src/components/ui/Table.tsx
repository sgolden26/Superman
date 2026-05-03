import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/classnames';

/**
 * Tabular primitives. Dense rows, monospaced numerics, sharp corners.
 * Pages compose <Table>, <thead>, <tbody> directly with these cells.
 */
export function Table({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full border-collapse text-sm', className)}
      {...rest}
    >
      {children}
    </table>
  );
}

interface CellAlignment {
  align?: 'left' | 'right';
  mono?: boolean;
}

export function Th({
  children,
  align = 'left',
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & CellAlignment & { children?: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  mono = false,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & CellAlignment & { children: ReactNode }) {
  return (
    <td
      className={cn(
        'border-b border-zinc-900 px-4 py-2.5',
        align === 'right' ? 'text-right' : 'text-left',
        mono ? 'font-mono tabular-nums text-[13px] text-zinc-300' : 'text-zinc-100',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
