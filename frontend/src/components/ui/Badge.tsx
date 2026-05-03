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
        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        tone,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
