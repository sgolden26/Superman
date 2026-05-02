import type { ReactNode } from 'react';
import { cn } from '@/lib/classnames';

export interface TopBarProps {
  title: string;
  right?: ReactNode;
}

export default function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-4 py-2 backdrop-blur">
      <h1 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h1>
      {right ? <div className={cn('flex shrink-0 items-center gap-2')}>{right}</div> : null}
    </header>
  );
}
