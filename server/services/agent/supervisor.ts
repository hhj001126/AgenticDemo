import { GoogleGenAI, Part, Content } from "@google/genai";
import { sessionService } from './state';
import { toolRegistry } from './registry';
import { toolManagerService } from '../tools/manager';
import { SUPERVISOR_SYSTEM } from '../prompts';
import { GEMINI_API_KEY } from '../../config';
import { AgentMode, Industry, AgentRoleConfig, ThinkingStep, Plan, ChartData } from '../../../types';

// Helper types
interface SupervisorAgentOptions {
    industry?: Industry | string;
    role?: AgentRoleConfig;
    customRules?: string;
    mode?: AgentMode;
}

// Retry logic
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

// Tool Helpers
function toolLabel(name: string): string {
    const tool = toolRegistry.get(name);
    const desc = tool?.definition?.description as string | undefined;
    if (!desc) return name;
    const first = desc.split(/[。；\.;]/)[0]?.trim();
    if (!first) return name;
    return first.length > 36 ? first.slice(0, 33) + "..." : first;
}

function thoughtSummary(raw: string, maxLen = 120): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed;
    return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "..." : firstLine;
}

// Execute Tool Calls
async function executeToolCalls(
    functionCalls: Array<{ name: string; id?: string; args: Record<string, unknown> }>,
    sessionId: string,
    blockingIds: Set<string>,
    callbacks: {
        onThinking: (step: ThinkingStep) => void;
        onPlanProposed?: (plan: Plan) => void;
        onChartData?: (data: ChartData) => void;
        onPlanStepUpdate?: (stepId: string, status: "in_progress" | "completed") => void;
    }
): Promise<{ parts: Part[]; writtenFilePaths: string[] }> {
    const hasPlanCall = functionCalls.some((f) => f.name === "propose_plan");
    const writtenFilePaths: string[] = [];
    const parts: Part[] = [];

    const executeOne = async (call: (typeof functionCalls)[0]) => {
        const stepId = `call-${call.id ?? call.name}`;
        const label = toolLabel(call.name);

        // Block execution if plan is pending approval (except propose_plan itself)
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
            callbacks.onChartData?.(call.args as unknown as ChartData);
            return {
                functionResponse: { name: call.name, response: { status: "CHART_RENDERED" }, id: call.id },
            } as Part;
        }

        const isBlocking = blockingIds.has(call.name);
        // write_file and generate_chart don't show "Thinking" for start, mostly result
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
            const result = await toolRegistry.execute(
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

            if (call.name === "report_step_done") {
                const stepId = (call.args as { stepId?: string })?.stepId;
                if (stepId) callbacks.onPlanStepUpdate?.(stepId, "completed");
            }

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


// Supervisor Agent Loop
export const supervisorAgent = async (
    sessionId: string,
    prompt: string,
    callbacks: {
        onThinking: (step: ThinkingStep) => void;
        onText: (chunk: string) => void;
        onPlanProposed?: (plan: Plan) => void;
        onChartData?: (data: ChartData) => void;
        onFilesWritten?: (paths: string[]) => void;
        onPlanStepUpdate?: (msgId: string, stepId: string, status: "in_progress" | "completed") => void;
    },
    params: {
        resumePlan?: Plan;
        isApprovalConfirmed?: boolean;
        planMsgId?: string;
        options?: SupervisorAgentOptions;
    }
) => {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    const sessionState = await sessionService.getSession(sessionId);
    let history: Content[] = sessionState?.geminiHistory || [];
    const blockingIds = toolRegistry.getBlockingIds();

    const mode = params.options?.mode ?? AgentMode.AGENTIC;
    
    // Construct System Instruction
    const instruction = SUPERVISOR_SYSTEM({
        industry: params.options?.industry as Industry, // Cast or handle type mismatch
        role: params.options?.role,
        customRules: params.options?.customRules,
        mode,
        hasMcpConnected: false // Backend: handle MCP separately if needed
    });

    // Filter tools
    const toolIds = toolRegistry.getDefinitions().map(d => d.name);
    let toolDefinitions = toolRegistry.getDefinitions()
        .filter((t) => t.name && toolManagerService.getToolEnabled(t.name));
        
    if (mode === AgentMode.TRADITIONAL) {
        toolDefinitions = toolDefinitions.filter((t) => t.name !== "propose_plan");
    }

    const thinkingBudget = mode === AgentMode.DEEP_SEARCH ? 16000 : 8000;

    // Handle User Input / Resume Plan
    if (prompt || params.resumePlan) {
        let userText = prompt;
        if (params.resumePlan && params.isApprovalConfirmed) {
            userText = `计划已批准。请按计划立即开始执行所有步骤：${JSON.stringify(params.resumePlan.steps.filter((s) => s.approved))}`;
        }
        history.push({ role: "user", parts: [{ text: userText }] });
    }

    let loopCount = 0;
    let currentTurnText = "";
    let thoughtStepId: string | null = null;

    while (loopCount < 10) {
        loopCount++;
        const turnId = `turn-${loopCount}`;

        const stream = await retryWithBackoff(() =>
            ai.models.generateContentStream({
                model: "gemini-2.0-flash-thinking-exp-01-21", // Using thinking model
                contents: history,
                config: {
                    systemInstruction: instruction,
                    tools: [{ functionDeclarations: toolDefinitions }],
                    // thinkingConfig: { thinkingBudget }, // Sdk param check needed
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
                        // Close thought if open
                        if (thoughtStepId && currentThought.trim()) {
                            callbacks.onThinking({
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
                        callbacks.onText(currentTurnText);
                        
                        if (accumulatedParts.length > 0 && accumulatedParts[accumulatedParts.length - 1].text) {
                            accumulatedParts[accumulatedParts.length - 1].text += part.text;
                        } else {
                            accumulatedParts.push({ text: part.text });
                        }
                    } else if ((part as any).thought) { // Check SDK type for thought
                        currentThought += (part as any).thought;
                        const summary = thoughtSummary(currentThought);
                        if (summary) {
                            callbacks.onThinking({
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
                         // Close thought if open
                        if (thoughtStepId && currentThought.trim()) {
                            callbacks.onThinking({
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
                            callbacks.onThinking({
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

        // Final thought close
        if (thoughtStepId && currentThought.trim()) {
             callbacks.onThinking({
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
        
        // Execute Tools
        const functionCalls = accumulatedParts.filter((p) => p.functionCall).map((p) => p.functionCall);

        if (functionCalls.length > 0) {
            const hasPlanCall = functionCalls.some((f: any) => f.name === "propose_plan");
            const blockingCalls = functionCalls.filter((f: any) => blockingIds.has(f.name));

            const { parts: responseParts, writtenFilePaths } = await executeToolCalls(
                functionCalls,
                sessionId,
                blockingIds,
                {
                    onThinking: callbacks.onThinking,
                    onPlanProposed: callbacks.onPlanProposed,
                    onChartData: callbacks.onChartData,
                    onPlanStepUpdate: params.planMsgId && callbacks.onPlanStepUpdate
                        ? (stepId, status) => callbacks.onPlanStepUpdate!(params.planMsgId!, stepId, status)
                        : undefined,
                }
            );

            if (writtenFilePaths.length > 0 && callbacks.onFilesWritten) {
                callbacks.onFilesWritten(writtenFilePaths);
            }

            history.push({ role: "user", parts: responseParts });

            if (hasPlanCall) break;
            if (blockingCalls.length > 0 && !hasPlanCall) continue;
        } else {
            break;
        }
    }

    await sessionService.updateSession(sessionId, { geminiHistory: history });
    return { text: currentTurnText };
};
