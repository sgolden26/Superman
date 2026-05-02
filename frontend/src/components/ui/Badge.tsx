import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/classnames';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  children: ReactNode;
}

export default function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
