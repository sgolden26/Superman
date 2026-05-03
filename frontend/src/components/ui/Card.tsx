import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/classnames';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'border border-zinc-800 bg-zinc-900 p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
