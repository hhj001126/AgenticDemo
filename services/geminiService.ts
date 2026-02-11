
import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import { Industry, ThinkingStep } from "../types";
import { agentStateService } from "./agentStateService";

// --- 1. Infrastructure Layer: Reliability & Configuration ---

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = 
        error?.status === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`Quota reached, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  return await fn();
}

// --- 2. Tooling Layer: MCP Simulation ---

const runSubAgent = async (role: string, task: string, context: string = "") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      SYSTEM_INSTRUCTION: You are a specialized Sub-Agent with the role: "${role}".
      YOUR TASK: ${task}
      CONTEXT_DATA: ${context}
      
      Output strictly the result of the task. Be professional and concise.
    `,
  }));
  return response.text || "";
};

const TOOL_REGISTRY: Record<string, { definition: FunctionDeclaration, executor: (args: any) => Promise<any> | any }> = {
  get_current_date: {
    definition: {
      name: "get_current_date",
      description: "获取系统当前标准时间。",
      parameters: { type: Type.OBJECT, properties: {} }
    },
    executor: () => ({ 
      iso: new Date().toISOString(), 
      weekday: new Date().toLocaleDateString('zh-CN', { weekday: 'long' }) 
    })
  },
  get_sales_performance: {
    definition: {
      name: "get_sales_performance",
      description: "查询年度销售业绩数据。",
      parameters: {
        type: Type.OBJECT,
        properties: { year: { type: Type.STRING, description: "年份 (e.g., '2024')" } },
        required: ["year"]
      }
    },
    executor: (args) => ({
      year: args.year,
      source: "Enterprise_ERP",
      data: [
        { name: "张伟", customers: 45, revenue: 1200000, region: "华北" },
        { name: "李娜", customers: 38, revenue: 950000, region: "华东" },
        { name: "王强", customers: 52, revenue: 1450000, region: "华南" }
      ]
    })
  },
  query_enterprise_kb: {
    definition: {
      name: "query_enterprise_kb",
      description: "RAG 检索企业内部知识库（合规、技术文档）。",
      parameters: {
        type: Type.OBJECT,
        properties: { 
          query: { type: Type.STRING, description: "语义搜索关键词" }
        },
        required: ["query"]
      }
    },
    executor: (args) => ({
      query: args.query,
      results: [
        { title: "2025合规手册", content: "根据第3章，涉及跨境营收的项目必须进行二次税务审计以确保合规性。" },
        { title: "项目Alpha规划", content: "项目Alpha预期ROI为12.5%，当前处于二期阶段。" }
      ]
    })
  },
  delegate_sub_agent: {
    definition: {
      name: "delegate_sub_agent",
      description: "将任务委派给具有特定角色的子 Agent。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "角色 (e.g., 'Legal_Auditor')" },
          task: { type: Type.STRING, description: "具体任务" },
          context: { type: Type.STRING, description: "背景上下文" }
        },
        required: ["role", "task"]
      }
    },
    executor: async (args) => {
      const output = await runSubAgent(args.role, args.task, args.context);
      return { output };
    }
  },
  calculate_roi: {
    definition: {
      name: "calculate_roi",
      description: "金融投资回报率计算工具。",
      parameters: {
        type: Type.OBJECT,
        properties: {
          investment: { type: Type.NUMBER },
          returns: { type: Type.NUMBER }
        },
        required: ["investment", "returns"]
      }
    },
    executor: (args) => ({ 
      roi_percentage: ((args.returns - args.investment) / args.investment * 100).toFixed(2),
      status: "CALCULATED"
    })
  },
  get_employee_info: {
    definition: {
      name: "get_employee_info",
      description: "查询员工档案及组织架构信息。",
      parameters: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING } },
        required: ["name"]
      }
    },
    executor: (args) => ({ 
      name: args.name, 
      id: "EMP_" + Math.floor(Math.random() * 10000),
      dept: "战略销售部", 
      level: "P7", 
      status: "ACTIVE" 
    })
  }
};

export const toolDefinitions = Object.values(TOOL_REGISTRY).map(t => t.definition);

// --- 3. Domain Logic Layer ---

const getIndustryPromptStrategy = (industry: Industry): string => {
  return `
    你是一个由 Spring Boot 架构驱动的企业级 Supervisor Agent。
    当前业务领域：${industry}
    
    核心原则：
    1. 编排工具链以解决复杂业务问题。
    2. 生成专业、结构化的 Markdown 报告。
    3. 数据可视化：如果结果包含数值对比，必须在回答中嵌入以下格式的 JSON 块。
    
    数据可视化规范：
    \`\`\`json
    {
      "chartData": {
        "type": "bar",
        "title": "分析图表",
        "labels": ["项A", "项B"],
        "datasets": [{ "label": "数值", "data": [100, 200] }]
      }
    }
    \`\`\`
  `;
};

// --- 4. Service Orchestrator ---

export const supervisorAgent = async (
  sessionId: string,
  prompt: string,
  industry: Industry,
  onThinking: (step: ThinkingStep) => void,
  onText: (chunk: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = getIndustryPromptStrategy(industry);
  const sessionState = agentStateService.getSession(sessionId);
  
  // Use a clean history for the internal loop
  let history: any[] = sessionState?.geminiHistory || [];
  history.push({ role: 'user', parts: [{ text: prompt }] });

  let loopCount = 0;
  const MAX_LOOPS = 10;
  let finalResponseText = "";

  try {
    while (loopCount < MAX_LOOPS) {
      loopCount++;

      // Always initialize and call generateContentStream for text/tool turns
      const stream = await retryWithBackoff(() => ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: history,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDefinitions }],
          temperature: 0.1,
          maxOutputTokens: 10000,
          thinkingConfig: { thinkingBudget: 4000 }
        }
      }));

      // CRITICAL: We must preserve the original Part objects (including thought_signature)
      const accumulatedParts: any[] = [];
      let currentTurnText = "";
      let currentThought = "";

      for await (const chunk of stream) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              currentTurnText += part.text;
              onText(currentTurnText);
              
              // Correctly aggregate text parts to minimize history bloat while preserving order
              if (accumulatedParts.length > 0 && accumulatedParts[accumulatedParts.length - 1].text !== undefined) {
                accumulatedParts[accumulatedParts.length - 1].text += part.text;
              } else {
                accumulatedParts.push({ text: part.text });
              }
            } else if (part.thought) {
              // IMPORTANT: The 'thought' part contains reasoning and the internal signature
              currentThought += part.thought;
              // Add original thought part to history
              accumulatedParts.push(part);
            } else if (part.functionCall) {
              // Add original functionCall part to history
              accumulatedParts.push(part);
            } else {
              // Handle any other part types as-is
              accumulatedParts.push(part);
            }
          }
        }
      }

      // Add model's aggregated turn to history
      history.push({ role: 'model', parts: accumulatedParts });

      // Identify function calls to execute
      const functionCalls = accumulatedParts.filter(p => p.functionCall).map(p => p.functionCall);

      if (functionCalls.length > 0) {
        // Handle reasoning visualization
        if (currentThought || currentTurnText) {
          onThinking({
            id: `thought-${Date.now()}-${loopCount}`,
            agentId: 'Supervisor-Logic',
            agentName: '逻辑编排',
            content: currentThought || currentTurnText,
            status: 'completed',
            timestamp: Date.now()
          });
          onText(""); // Prepare for the next turn's streaming text
        }

        const functionResponses: Part[] = [];

        for (const call of functionCalls) {
          const tool = TOOL_REGISTRY[call.name];
          
          onThinking({
            id: `exec-${call.id || Date.now()}-${loopCount}`,
            agentId: call.name,
            agentName: `调度工具: ${call.name}`,
            content: `正在检索业务系统数据...`,
            details: JSON.stringify(call.args),
            status: 'active',
            timestamp: Date.now()
          });

          try {
            const result = await (tool ? tool.executor(call.args) : { error: "Tool not found" });
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { result },
                id: call.id
              }
            });
            
            onThinking({
              id: `exec-${call.id || Date.now()}-${loopCount}`,
              agentId: call.name,
              agentName: `数据回传: ${call.name}`,
              content: `已成功获取底层数据回包。`,
              details: JSON.stringify(result, null, 2),
              status: 'completed',
              timestamp: Date.now()
            });
          } catch (e: any) {
            functionResponses.push({
              functionResponse: { name: call.name, response: { error: e.message }, id: call.id }
            });
          }
        }

        // Add tool results to history for next model turn
        history.push({ role: 'user', parts: functionResponses });
        agentStateService.saveSession(sessionId, { geminiHistory: history });
      } else {
        // No more tool calls, we reached the final answer
        finalResponseText = currentTurnText;
        agentStateService.saveSession(sessionId, { geminiHistory: history });
        break;
      }
    }

    return { text: finalResponseText };

  } catch (error: any) {
    console.error("Agent Orchestration Error:", error);
    throw error;
  }
};

// --- 5. Semantic Splitting ---

export const semanticChunker = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请对以下内容进行语义完整性切片，输出符合 Schema 的 JSON 数组：\n\n${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "切分段落原文" },
            summary: { type: Type.STRING, description: "语义摘要" },
            boundaryReason: { type: Type.STRING, description: "切分逻辑说明" }
          },
          required: ['content', 'summary', 'boundaryReason']
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Parse Error:", e);
    return [];
  }
};
