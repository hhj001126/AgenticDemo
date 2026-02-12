/**
 * 设计令牌 - Tech Control 主题
 * 实际值定义在 theme/tech-control.css，此处为 Tailwind 类名映射
 */
export const tokens = {
  colors: {
    primary: 'primary',
    primaryMuted: 'primary-50',
    primaryDark: 'primary-700',
    surface: 'surface',
    surfaceMuted: 'surface-muted',
    border: 'slate-200',
    borderMuted: 'slate-100',
    text: 'slate-900',
    textSecondary: 'slate-600',
    textMuted: 'slate-400',
    textDisabled: 'slate-300',
    accent: {
      success: 'emerald',
      warning: 'amber',
      error: 'rose',
      info: 'indigo',
    },
  },
  spacing: {
    xs: '1',   // 4px
    sm: '2',   // 8px
    md: '4',   // 16px
    lg: '6',   // 24px
    xl: '8',   // 32px
  },
  fontSize: {
    xs: 'text-xs',    // 12px
    sm: 'text-sm',    // 14px
    base: 'text-base', // 16px
    lg: 'text-lg',    // 18px
    xl: 'text-xl',    // 20px
  },
  fontWeight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
  },
  radius: {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    card: 'rounded-card',
    input: 'rounded-input',
    button: 'rounded-button',
  },
  shadow: {
    subtle: 'shadow-subtle',
    card: 'shadow-card',
  },
} as const;
