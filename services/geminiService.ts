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
      description: "对复杂需求进行深度分析。注意：如果任务包含多个阶段，请先使用 propose_plan。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING, description: "分析内容" },
          domain: { type: Type.STRING, description: "业务领域" }
        },
        required: ["context", "domain"]
      }
    },
    executor: async (args) => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `深度逻辑拆解：\n\n${args.context}`,
      });
      return { analysis: response.text, status: "COMPLETED" };
    }
  },
  propose_plan: {
    definition: {
      name: "propose_plan",
      description: "【核心工具】当任务涉及多个步骤（如先查询、再计算、最后写文件）时，必须首先调用此工具提议计划。禁止在未获得计划确认前直接执行写文件等写操作。",
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
      const steps = (args.steps || []).map((s: any) => ({ 
        ...s, 
        status: 'pending',
        approved: !s.requiresApproval,
        isAutoApproved: !s.requiresApproval 
      }));
      return { ...args, steps, isApproved: false };
    }
  },
  generate_chart: {
    definition: {
      name: "generate_chart",
      description: "数据可视化工具。",
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
      description: "写入虚拟文件。注意：除非用户明确指示且任务简单，否则必须在 propose_plan 之后执行。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: "路径" },
          content: { type: Type.STRING, description: "内容" },
          language: { type: Type.STRING, description: "语言" }
        },
        required: ["path", "content", "language"]
      }
    },
    executor: async (args, sessionId, onProgress) => {
      const { path, content, language } = args;
      // Initialize with empty content to show writing state
      agentStateService.updateVfs(sessionId, path, "", language);
      
      const words = content.split(' ');
      const batchSize = Math.max(5, Math.floor(words.length / 10));
      let accumulated = "";
      
      for (let i = 0; i < words.length; i += batchSize) {
        const chunk = words.slice(i, i + batchSize).join(' ') + " ";
        accumulated += chunk;
        agentStateService.updateVfs(sessionId, path, accumulated, language);
        if (onProgress) onProgress(`Streaming contents to ${path}... ${Math.min(100, Math.round((i/words.length)*100))}%`);
        await new Promise(r => setTimeout(r, 80)); // Smooth streaming delay
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
你的核心工作流遵循：【规划(Planning) -> 调度(Dispatching) -> 整合(Synthesis)】。

核心原则：
1. 逻辑与输出分离：所有关于“我将如何处理”、“分析过程”、“执行步骤说明”等中间逻辑，必须且只能存在于你的【思维/Thought】令牌中。最终输出的 Markdown 文本中严禁出现这些内容。
2. 复合需求处理：当用户提出包含多个任务的复合需求时，你必须先在思维中进行拆解，并调用 propose_plan 工具展示执行路径。
3. 最终呈现：Markdown 文本应直接展示结果。
4. 格式化 JSON：如果需要在文本中展示图表或计划数据，请使用标准的 JSON 代码块：
   - 图表：{"chartData": {...}}
   - 计划：{"plan": {"title": "...", "steps": [...]}}
5. 所有的元对话（元分析、拆解思路）必须放在【思维/Thought】令牌中，禁止出现在 Markdown 正文中。
6. 如果用户请求包含多项任务（如“先查询、再核算、最后写文件”），你必须在第一轮对话中仅调用 propose_plan，并给出思维分析。禁止在提议计划的同时调用 write_file。
7. 当需要确认propose_plan时， 只有在收到“计划已批准”或用户反馈后，你才进入调度阶段，依次调用具体执行工具。

行业语境：${industry}`;

  if (prompt || resumePlan) {
    let userText = prompt;
    if (resumePlan && isApprovalConfirmed) {
      userText = `计划已批准。请按计划立即开始执行所有步骤：${JSON.stringify(resumePlan.steps.filter(s => s.approved))}`;
    }
    history.push({ role: 'user', parts: [{ text: userText }] });
  }

  let loopCount = 0;
  let currentTurnText = "";

  while (loopCount < 10) {
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
              id: `th-stream-${Date.now()}`, agentId: 'supervisor', agentName: 'Supervisor 思维引擎', 
              content: '正在规划/调度逻辑...', 
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
      // Logic for strict sequencing: if propose_plan is called, stop other executions in this turn
      const hasPlanCall = functionCalls.some(f => f.name === 'propose_plan');
      
      const toolExecutions = functionCalls.map(async (call) => {
        const stepId = `call-${call.id}`;
        
        // If there's a plan call, only allow the plan call to finish
        if (hasPlanCall && call.name !== 'propose_plan') {
          return { functionResponse: { name: call.name, response: { error: "Execution blocked: Plan must be approved first." }, id: call.id } } as Part;
        }

        if (call.name === 'propose_plan') {
          const planData = call.args as Plan;
          onPlanProposed?.({ ...planData, isApproved: false, isCollapsed: false });
          return { functionResponse: { name: call.name, response: { status: "PLAN_PROPOSED_AWAITING_APPROVAL" }, id: call.id } } as Part;
        }

        if (call.name === 'generate_chart') {
          onChartData?.(call.args as ChartData);
          return { functionResponse: { name: call.name, response: { status: "CHART_RENDERED" }, id: call.id } } as Part;
        }

        onThinking({ 
          id: stepId, agentId: call.name, agentName: `执行代理: ${call.name}`, 
          content: `启动子代理处理任务...`, status: 'active', timestamp: Date.now()
        });

        try {
          const result = await (TOOL_REGISTRY[call.name] 
            ? TOOL_REGISTRY[call.name].executor(call.args, sessionId, (p) => {
                onThinking({ id: stepId, agentId: call.name, agentName: `执行代理: ${call.name}`, content: p, status: 'active', timestamp: Date.now() });
              }) 
            : { error: "ToolNotFound" });

          onThinking({ id: stepId, agentId: call.name, agentName: `执行代理: ${call.name}`, content: `任务处理完成。`, details: JSON.stringify(result, null, 2), status: 'completed', timestamp: Date.now() });
          return { functionResponse: { name: call.name, response: { result }, id: call.id } } as Part;
        } catch (e: any) {
          onThinking({ id: stepId, agentId: call.name, agentName: `执行代理: ${call.name}`, content: `执行失败`, status: 'failed', timestamp: Date.now() });
          return { functionResponse: { name: call.name, response: { error: e.message }, id: call.id } } as Part;
        }
      });

      const functionResponses = await Promise.all(toolExecutions);
      history.push({ role: 'user', parts: functionResponses });
      
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
    contents: `切片逻辑分析：\n\n${text}`,
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
