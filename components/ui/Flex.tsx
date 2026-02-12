import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

type FlexProps = {
  children: React.ReactNode;
  direction?: 'row' | 'col' | 'row-reverse';
  align?: 'start' | 'center' | 'end' | 'between';
  justify?: 'start' | 'center' | 'end' | 'between';
  gap?: 1 | 2 | 3 | 4 | 6;
  wrap?: boolean;
  className?: string;
};

const directionMap = { row: 'flex-row', col: 'flex-col', 'row-reverse': 'flex-row-reverse' };
const alignMap = { start: 'items-start', center: 'items-center', end: 'items-end', between: 'items-stretch' };
const justifyMap = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between' };
const gapMap = { 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6' };

export const Flex = memo<FlexProps>(
  ({ children, direction = 'row', align, justify, gap = 2, wrap, className }) => (
    <div
      className={cn(
        'flex',
        directionMap[direction],
        align && alignMap[align],
        justify && justifyMap[justify],
        gapMap[gap],
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </div>
  )
);
