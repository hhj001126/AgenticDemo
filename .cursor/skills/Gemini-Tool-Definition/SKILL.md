---
name: gemini-tool-definition
description: Adds or modifies Gemini function tools in TOOL_REGISTRY: definition schema, executor implementation, parameter types. Use when adding new Agent tools, extending geminiService, or when the user mentions tool/function calling.
---

# Gemini 工具定义

## 执行步骤

1. **定位 TOOL_REGISTRY**：在 `services/geminiService.ts` 中

2. **定义 FunctionDeclaration**：
   ```ts
   definition: {
     name: "tool_name_snake_case",
     description: "清晰描述工具用途，中文或英文",
     parameters: {
       type: Type.OBJECT,
       properties: {
         param1: { type: Type.STRING, description: "..." },
         param2: { type: Type.ARRAY, items: { type: Type.STRING } }
       },
       required: ["param1"]
     }
   }
   ```

3. **实现 executor**：
   ```ts
   executor: async (args, sessionId, onProgress) => {
     // 可调用 onProgress?.(content) 推送进度
     return { result: "...", status: "COMPLETED" };
   }
   ```

4. **注册到 TOOL_REGISTRY**：
   ```ts
   const TOOL_REGISTRY: Record<string, { definition: FunctionDeclaration, executor: ... }> = {
     tool_name: { definition, executor }
   };
   ```

5. **工具需同步到 `generateContent` 的 tools 配置**，否则模型无法调用
