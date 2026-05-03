import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
}

/**
 * Slim header strip below the TopBar. Title left, optional meta right
 * (e.g. row count, last-updated indicator).
 */
export default function PageHeader({ title, description, meta }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950 px-6 py-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      {meta ? (
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">{meta}</div>
      ) : null}
    </div>
  );
}
