---
name: gemini-tool-definition
description: Adds or modifies Gemini function tools and SubAgents via registry. Use when adding new Agent tools, extending geminiService, registering custom tools/subAgents, or when the user mentions tool/function calling.
---

# Gemini 工具与子代理定义

## 架构说明

- **工具注册中心**：`services/registry.ts` 中的 `toolRegistryService`
- **子代理注册中心**：`services/registry.ts` 中的 `subAgentRegistryService`
- **内置工具**：`services/builtinTools.ts` 中通过 `registerBuiltinTools()` 注册
- **MCP 工具**：`services/mcpService.ts` 连接 MCP 服务器后自动注册，工具管理页接入

## 方式一：通过统一标准注册（推荐）

### 注册工具

```ts
import { registerToolFromSpec } from "./services/geminiService";
import type { ToolRegistrationSpec } from "./types";

const spec: ToolRegistrationSpec = {
  id: "my_custom_tool",
  name: "my_custom_tool",
  description: "工具用途描述。说明使用时机与参数。",
  parameters: {
    param1: { type: "string", description: "参数说明", required: true },
    param2: { type: "number", description: "可选参数" },
  },
  executor: async (args, sessionId, onProgress) => {
    onProgress?.("执行中...");
    return { result: "...", status: "COMPLETED" };
  },
  blocking: false, // 阻塞式工具：Supervisor 需等待完成
};

registerToolFromSpec(spec, "user");
```

### 注册子代理

```ts
import { registerSubAgentFromSpec } from "./services/geminiService";
import type { SubAgentRegistrationSpec } from "./types";

const spec: SubAgentRegistrationSpec = {
  id: "my_sub_agent",
  name: "我的子代理",
  description: "子代理职责描述",
  systemPrompt: (vars) => `你是 ${vars.role} 专家。`,
  userPrompt: (vars) => `用户请求：${vars.userRequest}`,
};

registerSubAgentFromSpec(spec, "user");
```

## 方式二：直接使用 registry API

### 工具

```ts
import { toolRegistryService } from "./services/geminiService";
import { Type } from "@google/genai";

toolRegistryService.register(
  "tool_id",
  {
    definition: {
      name: "tool_id",
      description: "工具描述",
      parameters: {
        type: Type.OBJECT,
        properties: {
          param: { type: Type.STRING, description: "..." },
        },
        required: ["param"],
      },
    },
    executor: async (args, sessionId, onProgress) => {
      return { result: "..." };
    },
    blocking: false,
  },
  "user"
);
```

### 取消注册

```ts
toolRegistryService.unregister("tool_id");
subAgentRegistryService.unregister("sub_agent_id");
```

## 添加内置工具

在 `services/builtinTools.ts` 中调用 `toolRegistryService.register(..., "builtin")`，或 `subAgentRegistryService.register(..., "builtin")`。

## 通用 Supervisor 与角色配置

Supervisor 支持外部/用户指定 AI 角色：

```ts
supervisorAgent(
  sessionId,
  prompt,
  industry,
  onThinking,
  onText,
  onPlanProposed,
  onChartData,
  onFilesWritten,
  resumePlan,
  isApprovalConfirmed,
  {
    role: {
      id: "custom_role",
      name: "业务分析师",
      description: "负责业务需求分析与方案设计",
      customInstructions: "优先考虑合规与风控。",
    },
    customRules: "额外规则...",
  }
);
```

## 类型说明

| 类型 | 位置 | 说明 |
|------|------|------|
| `ToolDefinition` | types.ts | `{ definition, executor, blocking? }` |
| `SubAgentDefinition` | types.ts | `{ id, name, systemPrompt, userPrompt, outputSchema? }` |
| `ToolRegistrationSpec` | types.ts | 用户注册工具的标准接口 |
| `SubAgentRegistrationSpec` | types.ts | 用户注册子代理的标准接口 |
