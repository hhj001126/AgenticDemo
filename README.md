# Enterprise Agentic System Orchestrator

基于 Gemini API 的企业级 AI Agent 编排平台，实现 Supervisor 模式、语义分块与 Chain-of-Thought 可视化。

## 快速开始

1. 安装依赖：`npm install`
2. 配置 `.env.local`：设置 `GEMINI_API_KEY`
3. 启动：`npm run dev`
4. 访问：http://localhost:3000

## 样式说明

- **开发环境**：使用 Tailwind CDN，样式开箱即用
- **生产环境**：建议执行 `npm install` 安装 `tailwindcss`、`postcss`、`autoprefixer`，使用 PostCSS 构建以优化体积并消除 CDN 警告

## 构建

```bash
npm run build
npm run preview  # 预览构建结果
```
