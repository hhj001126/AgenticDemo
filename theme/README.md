# Tech Control 主题

面向 **Enterprise Agentic Orchestrator** 的科技控制台风格主题。

## 设计原则

- **Industrial / Utilitarian**：清晰、专业、技术感
- **主色**：青色 (#0891b2)，避免通用紫色
- **字体**：Plus Jakarta Sans（标题）+ Source Sans 3（正文）

## 文件结构

```
theme/
├── tech-control.css   # 主题变量定义
├── tokens.ts          # Tailwind 类名映射
└── README.md
```

## 切换主题

在 `index.css` 中修改导入：

```css
@import './theme/tech-control.css';  /* 默认 */
/* @import './theme/your-theme.css'; */
```

## 变量概览

| 类别 | 变量 |
|------|------|
| 主色 | `--color-primary`、`--color-primary-50` 等 |
| 背景 | `--bg-app`、`--bg-sidebar` |
| 字体 | `--font-display`、`--font-body` |
| 过渡 | `--transition-base`、`--ease-out` |
