import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface IconBadgeProps {
  icon: LucideIcon;
  size?: number;
  variant?: 'primary' | 'muted' | 'success' | 'warning';
  className?: string;
}

const variantStyles = {
  primary: 'bg-indigo-600 text-white',
  muted: 'bg-slate-100 text-slate-500',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
};

export const IconBadge = memo<IconBadgeProps>(({ icon: Icon, size = 18, variant = 'primary', className = '' }) => (
  <div className={`p-2 rounded-xl flex items-center justify-center ${variantStyles[variant]} ${className}`}>
    <Icon size={size} />
  </div>
));
