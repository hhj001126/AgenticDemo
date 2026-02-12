# AgenticDemo — 项目描述

## 项目概述

**Enterprise Agentic System Orchestrator** 是一个企业级 AI Agent 编排平台前端，实现 Supervisor 模式、语义分块、以及基于链式思考（Chain-of-Thought）的可视化能力。项目基于 **AI Studio** 模板构建，通过 **Gemini API** 驱动智能对话与工具调用。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 |
| 语言 | TypeScript |
| 构建 | Vite 6 |
| AI 引擎 | @google/genai（Gemini 系列） |
| UI 组件 | lucide-react |
| 富文本 | react-markdown + remark-gfm |

## 目录结构

```
AgenticDemo/
├── App.tsx              # 主应用入口，路由与布局
├── index.tsx             # React 挂载
├── index.html
├── types.ts              # 共享类型定义（Industry, AgentMode, Message, Plan, etc.）
├── theme/
│   └── tokens.ts         # 设计令牌（色彩、圆角、阴影）
├── components/           # React 组件
│   ├── AgentChat.tsx    # 智能对话与 Agent 编排主界面（组合 chat/ 子组件）
│   ├── CodeWorkspace.tsx # 代码/文件工作区
│   ├── ProjectExplorer.tsx
│   ├── SemanticChunker.tsx # 语义分块引擎
│   ├── Sidebar.tsx      # 侧边导航
│   ├── ThinkingProcess.tsx # 思考过程可视化
│   ├── VectorDatabase.tsx # 向量化资产管理
│   ├── VisualChart.tsx  # 图表渲染
│   ├── ui/              # 原子 UI 组件（唯一合法写 Tailwind 的地方）
│   │   ├── Badge.tsx、Button.tsx、Card.tsx、Flex.tsx
│   │   ├── IconBadge.tsx、Input.tsx、Surface.tsx
│   ├── chat/            # 对话相关子组件
│   │   ├── PlanView.tsx、ChatHeader.tsx、ChatInput.tsx
│   │   ├── MessageBubble.tsx、MarkdownWithCharts.tsx、QuickCommandGrid.tsx
│   ├── charts/          # 图表子组件
│   │   ├── BarChart.tsx、PieChartView.tsx、LineChart.tsx
│   ├── chunker/         # 语义分块子组件
│   ├── explorer/        # 项目浏览器子组件
│   ├── sidebar/         # 侧边栏子组件
│   ├── thinking/        # 思考过程子组件
│   ├── vector/          # 向量库子组件
│   └── workspace/       # 工作区子组件
├── services/             # 业务服务
│   ├── agentStateService.ts  # Agent 状态管理
│   └── geminiService.ts      # Gemini API 与工具调用
├── metadata.json        # 应用元数据（AI Studio）
└── vite.config.ts
```

## 核心能力

1. **智能编排控制台**：多 Agent 协作、计划提议、用户确认、执行跟踪
2. **语义处理引擎**：基于 SemanticChunker 的文档语义分块
3. **向量化资产管理**：向量数据库管理与检索
4. **能力网关中心**：标准化工具集接入（MCP 等）
5. **思考过程可视化**：Chain-of-Thought 展示、计划审批、图表生成

## 开发约定

- 使用 TypeScript 严格模式，类型优先
- 组件采用函数式 + Hooks，按需使用 `memo` 优化
- 状态持久化通过 `localStorage`（如 `agent_orchestrator_app_state`）
- API Key 通过 `.env.local` 中的 `GEMINI_API_KEY` 配置
- UI 风格：Tailwind 类名，圆角、阴影、indigo 主色
- **UI 规范**：业务组件禁止自定义 className，使用 `components/ui/` 原子组件；条件类名用 `cn` 工具（见 `.cursor/rules/UI-Design-System.mdc`）

## 运行方式

```bash
npm install
# 配置 .env.local 中的 GEMINI_API_KEY
npm run dev
```
