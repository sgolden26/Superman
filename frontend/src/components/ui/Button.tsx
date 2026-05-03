import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/classnames';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('font-medium transition-colors', variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
