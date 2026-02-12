import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

type ButtonVariant = 'primary' | 'ghost' | 'muted' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-700 text-white hover:bg-primary shadow-md hover:shadow-lg',
  ghost: 'text-text-muted hover:bg-surface-muted hover:text-primary',
  muted: 'bg-surface-muted text-text-secondary border border-border-muted hover:border-primary-500/40 hover:bg-primary-50 hover:text-primary-700',
  danger: 'text-text-muted hover:text-rose-600 hover:bg-rose-50',
  icon: 'text-text-muted hover:bg-surface-muted',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 rounded-lg text-sm font-medium',
  md: 'px-5 py-2.5 rounded-xl text-sm font-medium',
  lg: 'px-6 py-4 rounded-card text-[11px] font-black uppercase tracking-widest gap-2',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}

export const Button = memo<ButtonProps>(
  ({ variant = 'primary', size = 'md', children, className, ...props }) => (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center gap-2.5 transition-all duration-200',
        variantStyles[variant],
        sizeStyles[size],
        variant === 'icon' && 'p-2.5 rounded-lg',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
