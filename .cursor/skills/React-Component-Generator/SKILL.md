---
name: react-component-generator
description: Generates React functional components following project conventions: TypeScript props interfaces, lucide-react icons, Tailwind classes, memo for list items. Use when creating new UI components, pages, or when the user asks for component generation.
---

# React 组件生成

## 执行步骤

1. **定义 Props 接口**：显式声明，避免 `any`
   ```tsx
   interface ComponentNameProps { title: string; onClose?: () => void; }
   ```

2. **组件结构**：函数式 + 解构 props
   ```tsx
   const ComponentName: React.FC<ComponentNameProps> = ({ title, onClose }) => { ... }
   ```

3. **图标**：使用 `lucide-react`，保持与项目一致
   ```tsx
   import { CheckCircle, X } from 'lucide-react';
   ```

4. **样式**：Tailwind，主色 indigo，圆角 `rounded-2xl`，阴影 `shadow-xl`
   ```tsx
   <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xl" />
   ```

5. **列表子项**：使用 `memo` 包裹
   ```tsx
   const Item = memo(({ id, label }: ItemProps) => ...);
   ```

6. **导入顺序**：React → 第三方 → 项目内
