import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/classnames';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'border border-slate-800 bg-slate-900 p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
