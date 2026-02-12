import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

type BadgeVariant = 'primary' | 'muted' | 'success' | 'warning' | 'info';

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-primary-50 text-primary-700',
  muted: 'bg-slate-200 text-slate-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-surface-muted text-text-secondary',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[8px] rounded',
  md: 'px-2 py-1 rounded-full text-[10px]',
};

export const Badge = memo<BadgeProps>(
  ({ children, variant = 'primary', size = 'sm', className }) => (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-black uppercase tracking-tight',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  )
);
