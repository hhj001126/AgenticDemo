import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

type SurfaceVariant = 'default' | 'muted' | 'bordered';

interface SurfaceProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'sm' | 'md' | 'lg' | 'card';
  className?: string;
}

const variantStyles: Record<SurfaceVariant, string> = {
  default: 'bg-surface border-border',
  muted: 'bg-surface-muted border-border-muted',
  bordered: 'bg-surface border-border-muted',
};

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };
const roundedMap = { sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-2xl', card: 'rounded-card' };

export const Surface = memo<SurfaceProps>(
  ({ children, variant = 'default', padding = 'md', rounded = 'card', className }) => (
    <div
      className={cn(
        'border shadow-xl overflow-hidden',
        variantStyles[variant],
        paddingMap[padding],
        roundedMap[rounded],
        className
      )}
    >
      {children}
    </div>
  )
);
