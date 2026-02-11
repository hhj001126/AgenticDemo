import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import { Industry, ThinkingStep, Plan, ChartData } from "../types";
import { agentStateService } from "./agentStateService";
import { SUPERVISOR_SYSTEM, ANALYZE_REQUIREMENTS_PROMPT, PROPOSE_PLAN_SYSTEM, PROPOSE_PLAN_USER, SEMANTIC_CHUNKER_PROMPT } from "./prompts";

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if ((error?.status === 429 || error?.message?.includes('429')) && i < maxRetries - 1) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; continue;
      }
      throw error;
    }
  }
  return await fn();
}

/** 工具描述规范：用途 + 使用时机 + 参数说明 */
const TOOL_REGISTRY: Record<string, { definition: FunctionDeclaration, executor: (args: any, sessionId: string, onProgress?: (content: string) => void) => Promise<any> | any }> = {
  get_current_date: {
    definition: {
      name: "get_current_date",
      description: "获取当前系统时间（ISO 8601）。用于需要时间上下文的任务（如报表、排期）。",
      parameters: { type: Type.OBJECT, properties: {} }
    },
    executor: () => ({ iso: new Date().toISOString() })
  },
  analyze_data: {
    definition: {
      name: "analyze_data",
      description: "分析数据并回答查询。接受数据字符串和查询问题，返回包含发现的 JSON 对象。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          data: { type: Type.STRING, description: "待分析的数据（字符串格式）" },
          query: { type: Type.STRING, description: "查询问题或分析目标" }
        },
        required: ["data", "query"]
      }
    },
    executor: async (args, _sessionId, onProgress) => {
      const { data, query } = args as { data: string; query: string };
      // 模拟数据分析过程
      const findings = {
        summary: `基于 ${data.length} 字符的数据，针对查询"${query}"的分析结果`,
        insights: [
          `数据规模：${data.length} 字符`,
          `查询焦点：${query}`,
          `关键发现：数据中包含 ${(data.match(/\d+/g) || []).length} 个数字`,
        ],
        recommendations: ['建议进一步分析数据趋势', '考虑数据可视化展示'],
        timestamp: new Date().toISOString(),
      };
      
      // 模拟流式输出
      const resultStr = JSON.stringify(findings, null, 2);
      const chunks = resultStr.split(/(.{20})/).filter(Boolean);
      let accumulated = '';
      for (const chunk of chunks) {
        accumulated += chunk;
        onProgress?.(`分析中... ${Math.min(100, Math.round((accumulated.length / resultStr.length) * 100))}%`);
        await new Promise(r => setTimeout(r, 50));
      }
      
      return { findings, status: "COMPLETED" };
    }
  },
  analyze_requirements: {
    definition: {
      name: "analyze_requirements",
      description: "对复杂需求做精简分析：意图、实现路径、是否需 plan。输出流式返回。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING, description: "待分析的完整需求或业务描述" },
          domain: { type: Type.STRING, description: "业务领域（如：法律合规、金融财务、技术研发）" }
        },
        required: ["context", "domain"]
      }
    },
    executor: async (args, _sessionId, onProgress) => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: ANALYZE_REQUIREMENTS_PROMPT(args.context, args.domain),
      });
      let fullText = '';
      for await (const chunk of stream) {
        const text = (chunk as any).text ?? (chunk as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ?? '';
        if (text) {
          fullText += text;
          onProgress?.(fullText);
        }
      }
      return { analysis: fullText, status: "COMPLETED" };
    }
  },
  propose_plan: {
    definition: {
      name: "propose_plan",
      description: "【子代理】当需求为多步骤时调用。传入用户请求摘要，由子代理生成执行计划并等待用户批准。单步请求勿调用。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          userRequest: { type: Type.STRING, description: "用户请求或需求摘要，用于生成计划" },
          industry: { type: Type.STRING, description: "可选，行业语境（如通用政企、法律合规）" }
        },
        required: ["userRequest"]
      }
    },
    executor: async (args, _sessionId, onProgress) => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const userRequest = (args as any).userRequest ?? '';
      const industryArg = (args as any).industry ?? '通用';
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: PROPOSE_PLAN_USER(userRequest) }] },
        ],
        config: {
          systemInstruction: PROPOSE_PLAN_SYSTEM(industryArg),
        },
      });
      let fullText = '';
      let chunkCount = 0;
      for await (const chunk of stream) {
        const text = (chunk as any).text ?? (chunk as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ?? '';
        if (text) {
          fullText += text;
          chunkCount++;
          onProgress?.(`正在生成执行计划... 解析中`);
        }
      }
      const rawJson = fullText.replace(/```json\n?|\n?```/g, '').trim();
      let parsed: { title?: string; steps?: any[] };
      try {
        parsed = JSON.parse(rawJson) as any;
      } catch {
        return { error: "子代理未能生成有效计划", raw: fullText };
      }
      const steps = (parsed.steps || []).map((s: any) => ({
        id: s.id ?? `step-${Math.random().toString(36).slice(2, 8)}`,
        task: s.task ?? '',
        requiresApproval: !!s.requiresApproval,
        parallel: !!s.parallel,
        status: 'pending' as const,
        approved: true, // 默认全选
        isAutoApproved: !s.requiresApproval,
      }));
      const plan: Plan = {
        title: parsed.title ?? '执行计划',
        steps,
        isApproved: false,
      };
      return { plan, status: "PLAN_PROPOSED" };
    }
  },
  generate_chart: {
    definition: {
      name: "generate_chart",
      description: "生成数据可视化图表。支持柱状图(bar)、饼图(pie)、折线图(line)。需提供 labels 与 datasets。",
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
                color: { type: Type.STRING }
              },
              required: ["label", "data"]
            }
          }
        },
        required: ["type", "title", "labels", "datasets"]
      }
    },
    executor: (args) => args
  },
  write_file: {
    definition: {
      name: "write_file",
      description: "写入虚拟文件系统(VFS)。支持流式内容。多步骤任务须在 propose_plan 获批准后再调用；单步简单任务可直接调用。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: "文件路径（如 src/utils.ts）" },
          content: { type: Type.STRING, description: "文件内容（完整或部分）" },
          contentChunks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "文件内容块数组（用于流式写入）" },
          language: { type: Type.STRING, description: "编程语言或格式（如 typescript、markdown）" }
        },
        required: ["path", "language"]
      }
    },
    executor: async (args, sessionId, onProgress) => {
      const { path, content, contentChunks, language } = args;
      
      // 支持流式内容：contentChunks 优先，否则使用 content
      const chunks = contentChunks || (content ? [content] : []);
      
      // Initialize with empty content to show writing state
      agentStateService.updateVfs(sessionId, path, "", language, true);
      let accumulated = "";
      const totalChunks = chunks.length;
      
      // 流式写入每个块
      for (let i = 0; i < chunks.length; i++) {
        accumulated += chunks[i];
        agentStateService.updateVfs(sessionId, path, accumulated, language, true);
        if (onProgress) {
          const progress = totalChunks > 1 
            ? `Streaming chunk ${i + 1}/${totalChunks} to ${path}...`
            : `Writing ${path}... ${Math.min(100, Math.round(((i + 1) / totalChunks) * 100))}%`;
          onProgress(progress);
        }
      }
      
      // 确保最终内容完整，清除写入状态
      agentStateService.updateVfs(sessionId, path, accumulated, language, false);
      return { status: "SUCCESS", path };
    }
  }
};

const toolDefinitions = Object.values(TOOL_REGISTRY).map(t => t.definition);

/** 阻塞式工具：Supervisor 必须等待完成才能继续的工具 */
const BLOCKING_TOOLS = new Set(['analyze_requirements', 'propose_plan']);

export const supervisorAgent = async (
  sessionId: string,
  prompt: string,
  industry: Industry,
  onThinking: (step: ThinkingStep) => void,
  onText: (chunk: string) => void,
  onPlanProposed?: (plan: Plan) => void,
  onChartData?: (data: ChartData) => void,
  onFilesWritten?: (paths: string[]) => void,
  resumePlan?: Plan,
  isApprovalConfirmed?: boolean 
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sessionState = agentStateService.getSession(sessionId);
  let history: any[] = sessionState?.geminiHistory || [];
  
  const instruction = SUPERVISOR_SYSTEM({ industry });

  if (prompt || resumePlan) {
    let userText = prompt;
    if (resumePlan && isApprovalConfirmed) {
      userText = `计划已批准。请按计划立即开始执行所有步骤：${JSON.stringify(resumePlan.steps.filter(s => s.approved))}`;
    }
    history.push({ role: 'user', parts: [{ text: userText }] });
  }

  /** 从 AI 思维流中提取可展示的摘要（首行或前 N 字） */
  const thoughtSummary = (raw: string, maxLen = 120): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed;
    return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '...' : firstLine;
  };

  /** 从工具定义中获取展示名（description 首句，超长则截断） */
  const toolLabel = (name: string): string => {
    const def = TOOL_REGISTRY[name]?.definition;
    const desc = (def as any)?.description as string;
    if (!desc) return name;
    const first = desc.split(/[。；\.;]/)[0]?.trim();
    if (!first) return name;
    return first.length > 36 ? first.slice(0, 33) + '...' : first;
  };

  let loopCount = 0;
  let currentTurnText = "";
  let thoughtStepId: string | null = null;

  while (loopCount < 10) {
    loopCount++;
    const turnId = `turn-${loopCount}`;

    const stream = await retryWithBackoff(() => ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: history,
      config: {
        systemInstruction: instruction,
        tools: [{ functionDeclarations: toolDefinitions }],
        thinkingConfig: { thinkingBudget: 8000 }
      }
    }));

    const accumulatedParts: any[] = [];
    currentTurnText = "";
    let currentThought = "";
    thoughtStepId = `th-${turnId}`;

    for await (const chunk of stream) {
      const candidate = chunk.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            if (thoughtStepId && currentThought.trim()) {
              onThinking({
                id: thoughtStepId,
                agentId: 'supervisor',
                agentName: 'Supervisor',
                content: thoughtSummary(currentThought),
                details: currentThought,
                status: 'completed',
                timestamp: Date.now(),
              });
              thoughtStepId = null;
            }
            currentTurnText += part.text;
            onText(currentTurnText);
            if (accumulatedParts.length > 0 && accumulatedParts[accumulatedParts.length-1].text) {
               accumulatedParts[accumulatedParts.length-1].text += part.text;
            } else {
               accumulatedParts.push({ text: part.text });
            }
          } else if (part.thought) {
            currentThought += part.thought;
            const summary = thoughtSummary(currentThought);
            if (summary) {
              onThinking({
                id: thoughtStepId!,
                agentId: 'supervisor',
                agentName: 'Supervisor',
                content: summary,
                details: currentThought,
                status: 'active',
                timestamp: Date.now(),
              });
            }
            accumulatedParts.push(part);
          } else if (part.functionCall) {
            if (thoughtStepId && currentThought.trim()) {
              onThinking({
                id: thoughtStepId,
                agentId: 'supervisor',
                agentName: 'Supervisor',
                content: thoughtSummary(currentThought),
                details: currentThought,
                status: 'completed',
                timestamp: Date.now(),
              });
              thoughtStepId = null;
            }
            const fc = part.functionCall as any;
            const fcId = fc.id ?? `fc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const fcWithId = { ...fc, id: fcId };
            // write_file 和 generate_chart 不进入 thinking，归入正文区域
            if (fc.name !== 'write_file' && fc.name !== 'generate_chart') {
              const stepId = `call-${fcId}`;
              const label = toolLabel(fc.name);
              onThinking({
                id: stepId,
                agentId: fc.name,
                agentName: label,
                content: label,
                status: 'pending',
                timestamp: Date.now(),
              });
            }
            accumulatedParts.push({ ...part, functionCall: fcWithId });
          }
        }
      }
    }

    if (thoughtStepId && currentThought.trim()) {
      onThinking({
        id: thoughtStepId,
        agentId: 'supervisor',
        agentName: 'Supervisor',
        content: thoughtSummary(currentThought),
        details: currentThought,
        status: 'completed',
        timestamp: Date.now(),
      });
      thoughtStepId = null;
    }

    history.push({ role: 'model', parts: accumulatedParts });
    const functionCalls = accumulatedParts.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls.length > 0) {
      // Logic for strict sequencing: if propose_plan is called, stop other executions in this turn
      const hasPlanCall = functionCalls.some(f => f.name === 'propose_plan');
      const hasBlockingCall = functionCalls.some(f => BLOCKING_TOOLS.has(f.name));
      
      // 分离阻塞式和非阻塞式工具调用
      const blockingCalls = functionCalls.filter(f => BLOCKING_TOOLS.has(f.name));
      const nonBlockingCalls = functionCalls.filter(f => !BLOCKING_TOOLS.has(f.name));
      
      const writtenFilePaths: string[] = [];
      
      // 执行工具的函数
      const executeTool = async (call: any) => {
        const stepId = `call-${call.id}`;
        const label = toolLabel(call.name);

        if (hasPlanCall && call.name !== 'propose_plan') {
          return { functionResponse: { name: call.name, response: { error: "Execution blocked: Plan must be approved first." }, id: call.id } } as Part;
        }

        if (call.name === 'generate_chart') {
          onChartData?.(call.args as ChartData);
          return { functionResponse: { name: call.name, response: { status: "CHART_RENDERED" }, id: call.id } } as Part;
        }

        const isBlocking = BLOCKING_TOOLS.has(call.name);
        const isWriteFile = call.name === 'write_file';
        const isGenerateChart = call.name === 'generate_chart';
        
        // write_file 和 generate_chart 不 emit 到 onThinking，结果归入正文
        if (!isWriteFile && !isGenerateChart) {
          const initialContent = isBlocking ? `${label}（子代理执行中...）` : label;
          onThinking({
            id: stepId,
            agentId: call.name,
            agentName: label,
            content: initialContent,
            status: 'active',
            timestamp: Date.now(),
          });
        }

        try {
          const result = await (TOOL_REGISTRY[call.name]
            ? TOOL_REGISTRY[call.name].executor(call.args, sessionId, (p) => {
                if (!isWriteFile && !isGenerateChart) onThinking({ id: stepId, agentId: call.name, agentName: label, content: p, status: 'active', timestamp: Date.now() });
              })
            : { error: "ToolNotFound" });

          if (call.name === 'propose_plan' && typeof result === 'object' && result !== null && 'plan' in result) {
            onPlanProposed?.({ ...(result as any).plan, isApproved: false, isCollapsed: false });
          }

          if (isWriteFile && typeof result === 'object' && result !== null && 'path' in result) {
            writtenFilePaths.push((result as any).path);
          }

          if (!isWriteFile && !isGenerateChart) {
            const doneContent = typeof result === 'object' && result !== null && 'plan' in result
              ? `Plan: ${(result as any).plan?.title ?? '执行计划'}`
              : typeof result === 'object' && result !== null && 'analysis' in result
                ? (result as any).analysis?.slice?.(0, 80) + ((result as any).analysis?.length > 80 ? '...' : '') || label
                : label;

            onThinking({
              id: stepId,
              agentId: call.name,
              agentName: label,
              content: doneContent,
              details: JSON.stringify(result, null, 2),
              status: 'completed',
              timestamp: Date.now(),
            });
          }
          return { functionResponse: { name: call.name, response: { result }, id: call.id } } as Part;
        } catch (e: any) {
          if (!isWriteFile && !isGenerateChart) onThinking({ id: stepId, agentId: call.name, agentName: label, content: `Failed: ${e.message}`, details: e.message, status: 'failed', timestamp: Date.now() });
          return { functionResponse: { name: call.name, response: { error: e.message }, id: call.id } } as Part;
        }
      };
      
      // 先执行阻塞式工具（必须等待完成）
      const blockingResponses: Part[] = [];
      if (blockingCalls.length > 0) {
        const blockingExecutions = blockingCalls.map(executeTool);
        blockingResponses.push(...await Promise.all(blockingExecutions));
        history.push({ role: 'user', parts: blockingResponses });
        
        // 如果 propose_plan 执行完成，必须 break 等待用户批准
        if (hasPlanCall) {
          break;
        }
        
        // 其他阻塞式工具完成后，继续下一轮循环，让 Supervisor 基于结果进行决策
        continue;
      }
      
      // 执行非阻塞式工具（可并行，如多个 write_file 同时写入不同文件）
      const nonBlockingExecutions = nonBlockingCalls.map(executeTool);
      const nonBlockingResponses = await Promise.all(nonBlockingExecutions);
      
      if (writtenFilePaths.length > 0) {
        onFilesWritten?.(writtenFilePaths);
      }
      
      if (nonBlockingResponses.length > 0) {
        history.push({ role: 'user', parts: nonBlockingResponses });
      }
      
      if (hasPlanCall) break; // Force break loop if a plan was proposed
    } else {
      break;
    }
  }
  agentStateService.saveSession(sessionId, { geminiHistory: history });
  return { text: currentTurnText };
};

export const semanticChunker = async (text: string): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: SEMANTIC_CHUNKER_PROMPT(text),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            summary: { type: Type.STRING },
            boundaryReason: { type: Type.STRING }
          },
          required: ["content", "summary", "boundaryReason"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
