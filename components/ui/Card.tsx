import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export const Card = memo<CardProps>(({ children, className, padding = 'md', bordered = true }) => (
  <div
    className={cn(
      'bg-white rounded-card shadow-card overflow-hidden',
      paddingMap[padding],
      bordered ? 'border border-border' : 'border-transparent',
      className
    )}
  >
    {children}
  </div>
));
