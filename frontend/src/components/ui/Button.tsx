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
      className={cn('rounded-md font-medium transition', variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
