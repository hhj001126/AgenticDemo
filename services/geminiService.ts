import { GoogleGenAI, Type, Part } from "@google/genai";
import { Industry, ThinkingStep, Plan, ChartData, AgentRoleConfig } from "../types";
import { agentStateService } from "./agentStateService";
import { toolRegistryService } from "./registry";
import { SUPERVISOR_SYSTEM, SEMANTIC_CHUNKER_PROMPT } from "./prompts";
import { registerBuiltinTools } from "./builtinTools";

// 确保内置工具已注册
registerBuiltinTools();

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if ((error?.status === 429 || error?.message?.includes("429")) && i < maxRetries - 1) {
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  return await fn();
}

/** Supervisor 执行选项 */
export interface SupervisorAgentOptions {
  /** 行业/领域语境（兼容旧参数） */
  industry?: Industry | string;
  /** 外部或用户指定的 AI 角色配置 */
  role?: AgentRoleConfig;
  /** 自定义规则追加 */
  customRules?: string;
}

/** 阻塞式工具 ID 集合 */
const getBlockingIds = () => toolRegistryService.getBlockingIds();

/** 从工具定义获取展示名 */
function toolLabel(name: string): string {
  const tool = toolRegistryService.get(name);
  const desc = tool?.definition?.description as string | undefined;
  if (!desc) return name;
  const first = desc.split(/[。；\.;]/)[0]?.trim();
  if (!first) return name;
  return first.length > 36 ? first.slice(0, 33) + "..." : first;
}

/** 从 AI 思维流中提取可展示的摘要 */
function thoughtSummary(raw: string, maxLen = 120): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed;
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "..." : firstLine;
}

/** Agent 链：单轮工具执行 */
async function executeToolCalls(
  functionCalls: Array<{ name: string; id?: string; args: Record<string, unknown> }>,
  sessionId: string,
  blockingIds: Set<string>,
  callbacks: {
    onThinking: (step: ThinkingStep) => void;
    onPlanProposed?: (plan: Plan) => void;
    onChartData?: (data: ChartData) => void;
  }
): Promise<{ parts: Part[]; writtenFilePaths: string[] }> {
  const hasPlanCall = functionCalls.some((f) => f.name === "propose_plan");
  const writtenFilePaths: string[] = [];
  const parts: Part[] = [];

  const executeOne = async (call: (typeof functionCalls)[0]) => {
    const stepId = `call-${call.id ?? call.name}`;
    const label = toolLabel(call.name);

    if (hasPlanCall && call.name !== "propose_plan") {
      return {
        functionResponse: {
          name: call.name,
          response: { error: "Execution blocked: Plan must be approved first." },
          id: call.id,
        },
      } as Part;
    }

    if (call.name === "generate_chart") {
      callbacks.onChartData?.(call.args as ChartData);
      return {
        functionResponse: { name: call.name, response: { status: "CHART_RENDERED" }, id: call.id },
      } as Part;
    }

    const isBlocking = blockingIds.has(call.name);
    const isWriteFile = call.name === "write_file";
    const isGenerateChart = call.name === "generate_chart";

    if (!isWriteFile && !isGenerateChart) {
      callbacks.onThinking({
        id: stepId,
        agentId: call.name,
        agentName: label,
        content: isBlocking ? `${label}（子代理执行中...）` : label,
        status: "active",
        timestamp: Date.now(),
      });
    }

    try {
      const result = await toolRegistryService.execute(
        call.name,
        call.args,
        sessionId,
        (p) => {
          if (!isWriteFile && !isGenerateChart)
            callbacks.onThinking({
              id: stepId,
              agentId: call.name,
              agentName: label,
              content: p,
              status: "active",
              timestamp: Date.now(),
            });
        }
      );

      if (call.name === "propose_plan" && typeof result === "object" && result !== null && "plan" in result) {
        callbacks.onPlanProposed?.({ ...(result as any).plan, isApproved: false, isCollapsed: false });
      }

      if (isWriteFile && typeof result === "object" && result !== null && "path" in result) {
        writtenFilePaths.push((result as any).path);
      }

      if (!isWriteFile && !isGenerateChart) {
        const doneContent =
          typeof result === "object" && result !== null && "plan" in result
            ? `Plan: ${(result as any).plan?.title ?? "执行计划"}`
            : typeof result === "object" && result !== null && "analysis" in result
              ? (result as any).analysis?.slice?.(0, 80) + ((result as any).analysis?.length > 80 ? "..." : "") || label
              : label;

        callbacks.onThinking({
          id: stepId,
          agentId: call.name,
          agentName: label,
          content: doneContent,
          details: JSON.stringify(result, null, 2),
          status: "completed",
          timestamp: Date.now(),
        });
      }
      return {
        functionResponse: { name: call.name, response: { result }, id: call.id },
      } as Part;
    } catch (e: any) {
      if (!isWriteFile && !isGenerateChart)
        callbacks.onThinking({
          id: stepId,
          agentId: call.name,
          agentName: label,
          content: `Failed: ${e.message}`,
          details: e.message,
          status: "failed",
          timestamp: Date.now(),
        });
      return {
        functionResponse: { name: call.name, response: { error: e.message }, id: call.id },
      } as Part;
    }
  };

  const blockingCalls = functionCalls.filter((f) => blockingIds.has(f.name));
  const nonBlockingCalls = functionCalls.filter((f) => !blockingIds.has(f.name));

  const blockingResponses = await Promise.all(blockingCalls.map(executeOne));
  const nonBlockingResponses = await Promise.all(nonBlockingCalls.map(executeOne));

  parts.push(...blockingResponses, ...nonBlockingResponses);
  return { parts, writtenFilePaths };
}

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
  isApprovalConfirmed?: boolean,
  options?: SupervisorAgentOptions
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sessionState = agentStateService.getSession(sessionId);
  let history: any[] = sessionState?.geminiHistory || [];
  const blockingIds = getBlockingIds();

  const instruction = SUPERVISOR_SYSTEM({
    industry: options?.industry ?? industry,
    role: options?.role,
    customRules: options?.customRules,
  });

  if (prompt || resumePlan) {
    let userText = prompt;
    if (resumePlan && isApprovalConfirmed) {
      userText = `计划已批准。请按计划立即开始执行所有步骤：${JSON.stringify(resumePlan.steps.filter((s) => s.approved))}`;
    }
    history.push({ role: "user", parts: [{ text: userText }] });
  }

  const toolDefinitions = toolRegistryService.getDefinitions();
  let loopCount = 0;
  let currentTurnText = "";
  let thoughtStepId: string | null = null;

  while (loopCount < 10) {
    loopCount++;
    const turnId = `turn-${loopCount}`;

    const stream = await retryWithBackoff(() =>
      ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: history,
        config: {
          systemInstruction: instruction,
          tools: [{ functionDeclarations: toolDefinitions }],
          thinkingConfig: { thinkingBudget: 8000 },
        },
      })
    );

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
                agentId: "supervisor",
                agentName: "Supervisor",
                content: thoughtSummary(currentThought),
                details: currentThought,
                status: "completed",
                timestamp: Date.now(),
              });
              thoughtStepId = null;
            }
            currentTurnText += part.text;
            onText(currentTurnText);
            if (accumulatedParts.length > 0 && accumulatedParts[accumulatedParts.length - 1].text) {
              accumulatedParts[accumulatedParts.length - 1].text += part.text;
            } else {
              accumulatedParts.push({ text: part.text });
            }
          } else if (part.thought) {
            currentThought += part.thought;
            const summary = thoughtSummary(currentThought);
            if (summary) {
              onThinking({
                id: thoughtStepId!,
                agentId: "supervisor",
                agentName: "Supervisor",
                content: summary,
                details: currentThought,
                status: "active",
                timestamp: Date.now(),
              });
            }
            accumulatedParts.push(part);
          } else if (part.functionCall) {
            if (thoughtStepId && currentThought.trim()) {
              onThinking({
                id: thoughtStepId,
                agentId: "supervisor",
                agentName: "Supervisor",
                content: thoughtSummary(currentThought),
                details: currentThought,
                status: "completed",
                timestamp: Date.now(),
              });
              thoughtStepId = null;
            }
            const fc = part.functionCall as any;
            const fcId = fc.id ?? `fc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const fcWithId = { ...fc, id: fcId };
            if (fc.name !== "write_file" && fc.name !== "generate_chart") {
              const stepId = `call-${fcId}`;
              const label = toolLabel(fc.name);
              onThinking({
                id: stepId,
                agentId: fc.name,
                agentName: label,
                content: label,
                status: "pending",
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
        agentId: "supervisor",
        agentName: "Supervisor",
        content: thoughtSummary(currentThought),
        details: currentThought,
        status: "completed",
        timestamp: Date.now(),
      });
      thoughtStepId = null;
    }

    history.push({ role: "model", parts: accumulatedParts });
    const functionCalls = accumulatedParts.filter((p) => p.functionCall).map((p) => p.functionCall);

    if (functionCalls.length > 0) {
      const hasPlanCall = functionCalls.some((f) => f.name === "propose_plan");
      const blockingCalls = functionCalls.filter((f) => blockingIds.has(f.name));

      const { parts: responseParts, writtenFilePaths } = await executeToolCalls(
        functionCalls,
        sessionId,
        blockingIds,
        { onThinking, onPlanProposed, onChartData }
      );

      if (writtenFilePaths.length > 0) {
        onFilesWritten?.(writtenFilePaths);
      }

      history.push({ role: "user", parts: responseParts });

      if (hasPlanCall) break;
      if (blockingCalls.length > 0 && !hasPlanCall) continue;
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
    model: "gemini-3-flash-preview",
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
            boundaryReason: { type: Type.STRING },
          },
          required: ["content", "summary", "boundaryReason"],
        },
      },
    },
  });
  return JSON.parse(response.text || "[]");
};

/** 导出注册中心与注册 API，供用户通过统一标准注册自定义工具/子代理 */
export {
  toolRegistryService,
  subAgentRegistryService,
  registerToolFromSpec,
  registerSubAgentFromSpec,
} from "./registry";
export type {
  ToolDefinition,
  SubAgentDefinition,
  ToolRegistrationSpec,
  SubAgentRegistrationSpec,
} from "../types";
