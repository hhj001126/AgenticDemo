import React, { memo } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export const Card = memo<CardProps>(({ children, className = '', padding = 'md', bordered = true }) => (
  <div
    className={`bg-white ${paddingMap[padding]} rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden ${bordered ? 'border-slate-200' : 'border-transparent'} ${className}`}
  >
    {children}
  </div>
));
