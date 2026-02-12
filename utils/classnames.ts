/**
 * 条件类名合并工具
 * 用于替代模板字符串、三元运算符拼接 className
 * 始终将 className 放在末尾，便于外部覆盖
 */
type ClassValue = string | number | boolean | undefined | null | ClassValue[] | Record<string, boolean | undefined | null>;

function flatten(input: ClassValue): string[] {
  if (input === null || input === undefined || input === false) return [];
  if (typeof input === 'string') return input.trim() ? [input] : [];
  if (Array.isArray(input)) return input.flatMap(flatten);
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, v]) => Boolean(v))
      .flatMap(([k]) => flatten(k));
  }
  return [];
}

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flatMap(flatten)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
