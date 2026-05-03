import type { ReactNode } from 'react';

export interface TopBarProps {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
}

export default function TopBar({ title, eyebrow, right }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 pl-4 pr-3">
      <div className="flex items-baseline gap-3">
        {eyebrow ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h1>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </header>
  );
}
