import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const baseInput =
  'w-full bg-transparent border-none focus:ring-0 outline-none text-sm font-bold text-text';

export const Input = memo<InputProps>(({ className, ...props }) => (
  <input className={cn(baseInput, className)} {...props} />
));

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const Textarea = memo<TextareaProps>(({ className, ...props }) => (
  <textarea className={cn(baseInput, 'py-3 px-5 resize-none', className)} {...props} />
));

interface InputGroupProps {
  children: React.ReactNode;
  focused?: boolean;
  className?: string;
}

export const InputGroup = memo<InputGroupProps>(
  ({ children, focused, className }) => (
    <div
      className={cn(
        'flex items-end gap-3 p-2 rounded-input border-2 transition-all duration-300',
        'bg-surface-muted border-border-muted',
        focused && 'border-primary bg-surface',
        className
      )}
    >
      {children}
    </div>
  )
);
