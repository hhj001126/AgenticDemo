/**
 * 设计令牌 - 基于 theme-factory & frontend-design
 * 统一色彩、间距、圆角，便于主题切换
 */
export const tokens = {
  colors: {
    primary: 'indigo-600',
    primaryMuted: 'indigo-50',
    primaryDark: 'indigo-900',
    surface: 'white',
    surfaceMuted: 'slate-50',
    border: 'slate-200',
    borderMuted: 'slate-100',
    text: 'slate-900',
    textMuted: 'slate-400',
    accent: {
      success: 'emerald',
      warning: 'amber',
      error: 'rose',
      info: 'indigo',
    },
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-[2rem]',
  },
  shadow: {
    card: 'shadow-xl',
    subtle: 'shadow-sm',
    strong: 'shadow-2xl',
  },
} as const;
