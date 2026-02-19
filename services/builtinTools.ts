/**
 * 内置工具注册：统一通过 registry 注册
 * 应用启动时调用 registerBuiltinTools()
 */
import { Type } from "@google/genai";
import { agentStateService } from "./agentStateService";
import { todoService } from "./todoService";
import { toolRegistryService, subAgentRegistryService } from "./registry";
import {
  ANALYZE_REQUIREMENTS_PROMPT,
  PROPOSE_PLAN_SYSTEM,
  PROPOSE_PLAN_USER,
  SELF_REFLECT_PROMPT,
} from "./prompts";
import { getAgentContext } from "./agentContext";
import { toast } from "../utils/toast";
import type { Plan, ChartData } from "../types";
import { GoogleGenAI } from "@google/genai";

/** 注册内置工具与子代理 */
export function registerBuiltinTools(): void {
  const ai = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- Tools ---
  toolRegistryService.register(
    "create_todo",
    {
      definition: {
        name: "create_todo",
        description: "创建待办事项。参数：title、dueAt（可选，ISO 日期）、priority（可选：low/medium/high）。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "待办标题" },
            dueAt: { type: Type.STRING, description: "截止时间（ISO 8601）" },
            priority: { type: Type.STRING, enum: ["low", "medium", "high"], description: "优先级" },
          },
          required: ["title"],
        },
      },
      executor: (args) => {
        const { title, dueAt, priority } = args as { title: string; dueAt?: string; priority?: "low" | "medium" | "high" };
        const item = todoService.add(title, dueAt, priority);
        toast(`已添加待办：${item.title}`);
        return { status: "CREATED", id: item.id, title: item.title };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "list_todos",
    {
      definition: {
        name: "list_todos",
        description: "列出待办事项。includeCompleted 为 true 时包含已完成。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            includeCompleted: { type: Type.BOOLEAN, description: "是否包含已完成" },
          },
        },
      },
      executor: (args) => {
        const { includeCompleted = false } = (args || {}) as { includeCompleted?: boolean };
        const items = todoService.list(includeCompleted);
        return { todos: items, count: items.length };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "complete_todo",
    {
      definition: {
        name: "complete_todo",
        description: "将指定 ID 的待办标为已完成。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "待办 ID" },
          },
          required: ["id"],
        },
      },
      executor: (args) => {
        const { id } = args as { id: string };
        const ok = todoService.complete(id);
        if (ok) toast("待办已完成");
        return ok ? { status: "COMPLETED", id } : { status: "NOT_FOUND", id };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "search_knowledge",
    {
      definition: {
        name: "search_knowledge",
        description:
          "从当前会话知识库检索相关分块。用于文档、长文本相关问题时获取上下文。若知识库为空则返回空结果。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "检索关键词或问题摘要" },
            limit: { type: Type.NUMBER, description: "返回最大条数，默认 5" },
          },
          required: ["query"],
        },
      },
      executor: async (args, sessionId) => {
        const { query, limit = 5 } = args as { query: string; limit?: number };
        const chunks = await agentStateService.getKnowledgeChunks(sessionId);
        if (chunks.length === 0) return { matches: [], message: "知识库为空，请先在语义切片引擎中导入分块。" };
        const keywords = query
          .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const scored = chunks.map((c) => {
          let score = 0;
          const text = `${c.content} ${c.summary}`.toLowerCase();
          const qLower = query.toLowerCase();
          if (text.includes(qLower)) score += 10;
          for (const kw of keywords) {
            if (kw.length > 1 && text.includes(kw.toLowerCase())) score += 2;
          }
          return { chunk: c, score };
        });
        const matches = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((s) => s.chunk);
        return { matches, total: chunks.length };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "report_step_done",
    {
      definition: {
        name: "report_step_done",
        description:
          "计划执行时，每完成一个步骤后调用，传入该步骤的 id（如 step-1）。用于更新计划进度。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            stepId: { type: Type.STRING, description: "计划步骤 id，如 step-1" },
          },
          required: ["stepId"],
        },
      },
      executor: (args) => {
        const { stepId } = args as { stepId: string };
        return { status: "OK", stepId };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "get_current_date",
    {
      definition: {
        name: "get_current_date",
        description: "获取当前系统时间（ISO 8601）。用于需要时间上下文的任务。",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      executor: () => ({ iso: new Date().toISOString() }),
    },
    "builtin"
  );

  toolRegistryService.register(
    "analyze_data",
    {
      definition: {
        name: "analyze_data",
        description: "分析数据并回答查询。接受数据字符串和查询问题，返回包含发现的 JSON 对象。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: { type: Type.STRING, description: "待分析的数据（字符串格式）" },
            query: { type: Type.STRING, description: "查询问题或分析目标" },
          },
          required: ["data", "query"],
        },
      },
      executor: async (args, _sessionId, onProgress) => {
        const { data, query } = args as { data: string; query: string };
        const findings = {
          summary: `基于 ${data.length} 字符的数据，针对查询"${query}"的分析结果`,
          insights: [
            `数据规模：${data.length} 字符`,
            `查询焦点：${query}`,
            `关键发现：数据中包含 ${(data.match(/\d+/g) || []).length} 个数字`,
          ],
          recommendations: ["建议进一步分析数据趋势", "考虑数据可视化展示"],
          timestamp: new Date().toISOString(),
        };
        const resultStr = JSON.stringify(findings, null, 2);
        const chunks = resultStr.split(/(.{20})/).filter(Boolean);
        let accumulated = "";
        for (const chunk of chunks) {
          accumulated += chunk;
          onProgress?.(`分析中... ${Math.min(100, Math.round((accumulated.length / resultStr.length) * 100))}%`);
          await new Promise((r) => setTimeout(r, 50));
        }
        return { findings, status: "COMPLETED" };
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "analyze_requirements",
    {
      definition: {
        name: "analyze_requirements",
        description: "对复杂需求做精简分析：意图、实现路径、是否需 plan。输出流式返回。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING, description: "待分析的完整需求或业务描述" },
            domain: { type: Type.STRING, description: "业务领域（如：法律合规、金融财务、技术研发）" },
          },
          required: ["context", "domain"],
        },
      },
      executor: async (args, _sessionId, onProgress) => {
        const { context, domain } = args as { context: string; domain: string };
        const { mode } = getAgentContext();
        const stream = await ai().models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: ANALYZE_REQUIREMENTS_PROMPT(context, domain, mode) }] }],
        });
        let fullText = "";
        for await (const chunk of stream) {
          const text =
            (chunk as any).text ??
            (chunk as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ??
            "";
          if (text) {
            fullText += text;
            onProgress?.(fullText);
          }
        }
        return { analysis: fullText, status: "COMPLETED" };
      },
      blocking: true,
    },
    "builtin"
  );

  toolRegistryService.register(
    "propose_plan",
    {
      definition: {
        name: "propose_plan",
        description:
          "当需求为多步骤时调用。传入用户请求摘要，由子代理生成执行计划并等待用户批准。单步请求勿调用。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            userRequest: { type: Type.STRING, description: "用户请求或需求摘要，用于生成计划" },
            industry: { type: Type.STRING, description: "可选，行业语境（如通用政企、法律合规）" },
          },
          required: ["userRequest"],
        },
      },
      executor: async (args, _sessionId, onProgress) => {
        const userRequest = (args as any).userRequest ?? "";
        const industryArg = (args as any).industry ?? "通用";
        const stream = await ai().models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: PROPOSE_PLAN_USER(userRequest) }] }],
          config: { systemInstruction: PROPOSE_PLAN_SYSTEM(industryArg) },
        });
        let fullText = "";
        for await (const chunk of stream) {
          const text =
            (chunk as any).text ??
            (chunk as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ??
            "";
          if (text) {
            fullText += text;
            onProgress?.("正在生成执行计划... 解析中");
          }
        }
        const rawJson = fullText.replace(/```json\n?|\n?```/g, "").trim();
        let parsed: { title?: string; steps?: any[] };
        try {
          parsed = JSON.parse(rawJson) as any;
        } catch {
          return { error: "子代理未能生成有效计划", raw: fullText };
        }
        const steps = (parsed.steps || []).map((s: any) => ({
          id: s.id ?? `step-${Math.random().toString(36).slice(2, 8)}`,
          task: s.task ?? "",
          requiresApproval: !!s.requiresApproval,
          parallel: !!s.parallel,
          status: "pending" as const,
          approved: true,
          isAutoApproved: !s.requiresApproval,
        }));
        const plan: Plan = {
          title: parsed.title ?? "执行计划",
          steps,
          isApproved: false,
        };
        return { plan, status: "PLAN_PROPOSED" };
      },
      blocking: true,
    },
    "builtin"
  );

  toolRegistryService.register(
    "generate_chart",
    {
      definition: {
        name: "generate_chart",
        description:
          "生成数据可视化图表。支持柱状图(bar)、饼图(pie)、折线图(line)。需提供 labels 与 datasets。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["bar", "pie", "line"] },
            title: { type: Type.STRING },
            labels: { type: Type.ARRAY, items: { type: Type.STRING } },
            datasets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  data: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  color: { type: Type.STRING },
                },
                required: ["label", "data"],
              },
            },
          },
          required: ["type", "title", "labels", "datasets"],
        },
      },
      executor: (args) => args as unknown as ChartData,
    },
    "builtin"
  );

  toolRegistryService.register(
    "self_reflect",
    {
      definition: {
        name: "self_reflect",
        description:
          "对当前输出做自检，返回供 Agent 自行改进的要点。写操作或多步骤任务执行后可调用。若返回 improvements，Agent 须立即补充执行，不可呈现给用户。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            outputSummary: { type: Type.STRING, description: "当前输出或执行结果的简要摘要" },
            userRequest: { type: Type.STRING, description: "用户原始需求或目标" },
          },
          required: ["outputSummary", "userRequest"],
        },
      },
      executor: async (args) => {
        const { outputSummary, userRequest } = args as { outputSummary: string; userRequest: string };
        const response = await ai().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: SELF_REFLECT_PROMPT(outputSummary, userRequest) }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                satisfied: { type: Type.BOOLEAN, description: "是否满足用户需求" },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "遗漏点列表" },
                improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "供 Agent 立即执行的改进动作" },
              },
              required: ["satisfied", "gaps", "improvements"],
            },
          },
        });
        return JSON.parse(response.text || "{}");
      },
    },
    "builtin"
  );

  toolRegistryService.register(
    "write_file",
    {
      definition: {
        name: "write_file",
        description:
          "写入虚拟文件系统(VFS)。支持流式内容。多步骤任务须在 propose_plan 获批准后再调用；单步简单任务可直接调用。",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "文件路径（如 src/utils.ts）" },
            content: { type: Type.STRING, description: "文件内容（完整或部分）" },
            contentChunks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "文件内容块数组（用于流式写入）",
            },
            language: { type: Type.STRING, description: "编程语言或格式（如 typescript、markdown）" },
          },
          required: ["path", "language"],
        },
      },
      executor: async (args, sessionId, onProgress) => {
        const { path, content, contentChunks, language } = args as {
          path: string;
          content?: string;
          contentChunks?: string[];
          language: string;
        };
        const chunks = contentChunks || (content ? [content] : []);
        await agentStateService.updateVfs(sessionId, path, "", language, true);
        let accumulated = "";
        const totalChunks = chunks.length;
        for (let i = 0; i < chunks.length; i++) {
          accumulated += chunks[i];
          await agentStateService.updateVfs(sessionId, path, accumulated, language, true);
          if (onProgress) {
            const progress =
              totalChunks > 1
                ? `Streaming chunk ${i + 1}/${totalChunks} to ${path}...`
                : `Writing ${path}... ${Math.min(100, Math.round(((i + 1) / totalChunks) * 100))}%`;
            onProgress(progress);
          }
        }
        await agentStateService.updateVfs(sessionId, path, accumulated, language, false);
        return { status: "SUCCESS", path };
      },
    },
    "builtin"
  );

  // --- SubAgents ---
  subAgentRegistryService.register(
    "propose_plan",
    {
      id: "propose_plan",
      name: "计划编排子代理",
      description: "根据用户请求生成可执行计划",
      systemPrompt: (vars) => PROPOSE_PLAN_SYSTEM(vars.industry ?? "通用"),
      userPrompt: (vars) => PROPOSE_PLAN_USER(vars.userRequest ?? ""),
    },
    "builtin"
  );
}
