
import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import { Industry, ThinkingStep, Plan, ChartData } from "../types";
import { agentStateService } from "./agentStateService";

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

const TOOL_REGISTRY: Record<string, { definition: FunctionDeclaration, executor: (args: any, sessionId: string, onProgress?: (content: string) => void) => Promise<any> | any }> = {
  get_current_date: {
    definition: { name: "get_current_date", description: "获取当前系统时间。", parameters: { type: Type.OBJECT, properties: {} } },
    executor: () => ({ iso: new Date().toISOString() })
  },
  analyze_requirements: {
    definition: {
      name: "analyze_requirements",
      description: "对复杂需求进行深度分析，提取核心约束、业务逻辑点和实施建议。适用于所有政企领域。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING, description: "需要分析的需求原始文本" },
          domain: { type: Type.STRING, description: "当前业务领域(如：财务、法律、技术等)" }
        },
        required: ["context", "domain"]
      }
    },
    executor: async (args) => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `你是一个跨领域的政企高级顾问。请针对以下需求背景在[${args.domain}]领域内进行深度逻辑拆解和实施方案建议：\n\n${args.context}`,
      });
      return { analysis: response.text, status: "COMPLETED" };
    }
  },
  propose_plan: {
    definition: {
      name: "propose_plan",
      description: "当任务较为复杂或涉及敏感操作时，向用户提议一个多步骤执行计划。执行将在此步骤暂停，等待用户确认。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "计划标题" },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                task: { type: Type.STRING },
                requiresApproval: { type: Type.BOOLEAN },
                parallel: { type: Type.BOOLEAN }
              },
              required: ["id", "task", "requiresApproval", "parallel"]
            }
          }
        },
        required: ["title", "steps"]
      }
    },
    executor: async (args) => {
      // Mark steps that don't need approval as auto-approved
      const steps = (args.steps || []).map((s: any) => ({ 
        ...s, 
        approved: !s.requiresApproval,
        isAutoApproved: !s.requiresApproval 
      }));
      return { ...args, steps, isApproved: false };
    }
  },
  generate_chart: {
    definition: {
      name: "generate_chart",
      description: "当数据分析结果需要以图表形式展示时调用（柱状图、饼图、折线图）。",
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
      description: "将生成的内容、文档或代码写入虚拟文件系统. 仅在用户明确要求保存或生成文件时使用。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: "目标文件路径" },
          content: { type: Type.STRING, description: "文件完整内容" },
          language: { type: Type.STRING, description: "内容语言类型(markdown/java/json等)" }
        },
        required: ["path", "content", "language"]
      }
    },
    executor: async (args, sessionId, onProgress) => {
      const { path, content, language } = args;
      agentStateService.updateVfs(sessionId, path, "", language);
      const lines = content.split('\n');
      const batchSize = Math.max(1, Math.floor(lines.length / 5));
      let accumulated = "";
      for (let i = 0; i < lines.length; i += batchSize) {
        const chunk = lines.slice(i, i + batchSize).join('\n') + (i + batchSize < lines.length ? '\n' : '');
        accumulated += chunk;
        agentStateService.updateVfs(sessionId, path, accumulated, language);
        if (onProgress) onProgress(`正在同步文件内容 ${path}: ${Math.round((Math.min(i + batchSize, lines.length) / lines.length) * 100)}%`);
        await new Promise(r => setTimeout(r, 150));
      }
      agentStateService.updateVfs(sessionId, path, content, language);
      return { status: "SUCCESS", path };
    }
  }
};

const toolDefinitions = Object.values(TOOL_REGISTRY).map(t => t.definition);

export const supervisorAgent = async (
  sessionId: string,
  prompt: string,
  industry: Industry,
  onThinking: (step: ThinkingStep) => void,
  onText: (chunk: string) => void,
  onPlanProposed?: (plan: Plan) => void,
  onChartData?: (data: ChartData) => void,
  resumePlan?: Plan,
  isApprovalConfirmed?: boolean 
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sessionState = agentStateService.getSession(sessionId);
  let history: any[] = sessionState?.geminiHistory || [];
  
  const instruction = `你是一个全能的政企级 AI Supervisor (控制中枢)。你的职责是处理复杂的多步骤业务请求。
  
核心原则：
1. 逻辑与输出分离：所有关于“我将如何处理”、“分析过程”、“执行步骤说明”等中间逻辑，必须且只能存在于你的【思维/Thought】令牌中。最终输出的 Markdown 文本中严禁出现这些内容。
2. 复合需求处理：当用户提出包含多个任务（如查询、预约、计算、写作）的复合需求时，你必须先在思维中进行拆解，并调用 propose_plan 工具展示执行路径。
3. 最终呈现：Markdown 文本应直接展示结果（如祝福语、分析报告、核算结果）。
4. 格式化 JSON：如果需要在文本中展示图表或计划数据，请使用标准的 JSON 代码块：
   - 图表：{"chartData": {...}}
   - 计划：{"plan": {"title": "...", "steps": [...]}}
   系统会自动美化这些 JSON 块。

工具调用规范：
- propose_plan: 必须用于涉及多个逻辑阶段的任务。
- generate_chart: 用于展示数值对比。
- write_file: 用于持久化文档或代码。

业务上下文：
- 当前行业：${industry}
- 编排模式：智能编排 (Supervisor Pattern)`;

  if (prompt || resumePlan) {
    let userText = "";
    if (resumePlan) {
      if (isApprovalConfirmed) {
        userText = `计划已批准。请按计划执行：${JSON.stringify(resumePlan.steps.filter(s => s.approved))}`;
      } else {
        userText = `用户针对当前待审批计划提出了新的补充建议或调整，请结合最新输入重新评估任务并执行：\n最新输入: ${prompt}\n当前待审批计划: ${JSON.stringify(resumePlan)}`;
      }
    } else {
      userText = prompt;
    }
    history.push({ role: 'user', parts: [{ text: userText }] });
  }

  let loopCount = 0;
  let currentTurnText = "";

  while (loopCount < 15) {
    loopCount++;
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

    for await (const chunk of stream) {
      const candidate = chunk.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            currentTurnText += part.text;
            onText(currentTurnText);
            if (accumulatedParts.length > 0 && accumulatedParts[accumulatedParts.length-1].text) {
               accumulatedParts[accumulatedParts.length-1].text += part.text;
            } else {
               accumulatedParts.push({ text: part.text });
            }
          } else if (part.thought) {
            currentThought += part.thought;
            onThinking({ 
              id: `th-stream-${Date.now()}`, agentId: 'supervisor', agentName: '逻辑编排', 
              content: '正在处理深度逻辑链...', 
              details: currentThought,
              status: 'active', timestamp: Date.now() 
            });
            accumulatedParts.push(part);
          } else if (part.functionCall) {
            accumulatedParts.push(part);
          }
        }
      }
    }

    history.push({ role: 'model', parts: accumulatedParts });
    const functionCalls = accumulatedParts.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls.length > 0) {
      if (currentThought) {
        onThinking({ 
          id: `th-${Date.now()}-${loopCount}`, agentId: 'supervisor', agentName: '逻辑完成', 
          content: '逻辑解析完成，正在调用业务单元执行任务...', 
          details: currentThought,
          status: 'completed', timestamp: Date.now() 
        });
      }

      const toolExecutions = functionCalls.map(async (call) => {
        const stepId = `call-${call.id}`;
        
        if (call.name === 'propose_plan') {
          const planData = call.args as Plan;
          planData.steps = (planData.steps || []).map(s => ({ 
            ...s, 
            approved: !s.requiresApproval,
            isAutoApproved: !s.requiresApproval 
          }));
          onPlanProposed?.({ ...planData, isApproved: false, isCollapsed: false });
          return { functionResponse: { name: call.name, response: { status: "AWAITING_APPROVAL" }, id: call.id } } as Part;
        }

        if (call.name === 'generate_chart') {
          const chartData = call.args as ChartData;
          onChartData?.(chartData);
          return { functionResponse: { name: call.name, response: { status: "CHART_GENERATED" }, id: call.id } } as Part;
        }

        const toolNameMap: Record<string, string> = {
          'write_file': '并行文件写入任务',
          'analyze_requirements': '深度需求分析工具',
          'get_current_date': '系统时钟服务'
        };

        const agentName = toolNameMap[call.name] || call.name;

        onThinking({ 
          id: stepId, agentId: call.name, 
          agentName, 
          content: `业务单元 [${call.name}] 响应中...`, 
          status: 'active', timestamp: Date.now(),
          group: call.name,
          fileLink: call.name === 'write_file' ? call.args.path : undefined
        });

        try {
          const result = await (TOOL_REGISTRY[call.name] 
            ? TOOL_REGISTRY[call.name].executor(call.args, sessionId, (p) => {
                onThinking({ 
                  id: stepId, agentId: call.name, 
                  agentName, 
                  content: p, status: 'active', timestamp: Date.now(), group: call.name, fileLink: call.args.path 
                });
              }) 
            : { error: "ToolNotFound" });

          onThinking({ 
            id: stepId, agentId: call.name, 
            agentName, 
            content: `操作执行完毕。`, 
            details: `执行结果: ${JSON.stringify(result, null, 2)}`, 
            status: 'completed', timestamp: Date.now(), group: call.name,
            fileLink: call.name === 'write_file' ? call.args.path : undefined
          });

          return { functionResponse: { name: call.name, response: { result }, id: call.id } } as Part;
        } catch (e: any) {
          onThinking({ id: stepId, agentId: call.name, agentName, content: `执行异常: ${e.message}`, status: 'failed', timestamp: Date.now(), group: call.name });
          return { functionResponse: { name: call.name, response: { error: e.message }, id: call.id } } as Part;
        }
      });

      const functionResponses = await Promise.all(toolExecutions);
      history.push({ role: 'user', parts: functionResponses });
      
      if (functionCalls.some(f => f.name === 'propose_plan')) break;
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
    contents: `请将以下长文本进行语义切片（Semantic Chunking）。
每个切片应该是逻辑完整的，并提供简洁的摘要和切分理由。
文本内容：
${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "切片的原始文本内容" },
            summary: { type: Type.STRING, description: "该切片的语义摘要" },
            boundaryReason: { type: Type.STRING, description: "为什么在此处进行切分的逻辑理由" }
          },
          required: ["content", "summary", "boundaryReason"]
        }
      }
    }
  });

  try {
    const resultText = response.text || "[]";
    const result = JSON.parse(resultText);
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("Failed to parse semantic chunks", e);
    return [];
  }
};
