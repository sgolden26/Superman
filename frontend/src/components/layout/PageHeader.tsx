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
    <div className="flex items-start justify-between gap-4 border-b border-mil-800 bg-mil-950 px-6 py-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-mil-50">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-mil-400">{description}</p>
        ) : null}
      </div>
      {meta ? <div className="max-w-[min(100%,28rem)] shrink-0 text-right">{meta}</div> : null}
    </div>
  );
}
