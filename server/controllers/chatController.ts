import { Request, Response } from 'express';
import { supervisorAgent } from '../services/agent/supervisor';
import { sessionService } from '../services/agent/state';
import { ThinkingStep, Plan, ChartData, Message } from '../../types';

// Helper to push SSE events
const sendEvent = (res: Response, type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
};

export const chatStream = async (req: Request, res: Response) => {
    const { 
        sessionId, 
        message, 
        params // { resumePlan, isApprovalConfirmed, planMsgId, options }
    } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Save user message first if it's a new message
        if (message && !params?.isApprovalConfirmed) {
            const session = await sessionService.getSession(sessionId);
            if (session) {
                const userMsg: Message = { 
                    id: Date.now().toString(), 
                    role: 'user', 
                    content: message, 
                    timestamp: Date.now() 
                };
                session.uiMessages = [...session.uiMessages, userMsg];
                await sessionService.saveSession(sessionId, session);
            }
        }
        
        // Prepare Assistant Message ID
        const assistantMsgId = `agent-${Date.now()}`;
        
        // Persist initial assistant message
        const session = await sessionService.getSession(sessionId);
        if (session) {
            const assistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                thinkingSteps: [],
                timestamp: Date.now()
            };
            session.uiMessages.push(assistantMsg);
            await sessionService.saveSession(sessionId, session);
        }

        await supervisorAgent(
            sessionId,
            message,
            {
                onThinking: async (step: ThinkingStep) => {
                    sendEvent(res, 'thinking', { step });
                    // Persist thinking step
                    const current = await sessionService.getSession(sessionId);
                    if (current) {
                        const msg = current.uiMessages.find(m => m.id === assistantMsgId);
                        if (msg) {
                            msg.thinkingSteps = [
                                ...(msg.thinkingSteps || []).filter(s => s.id !== step.id),
                                step
                            ];
                            await sessionService.saveSession(sessionId, current);
                        }
                    }
                },
                onText: async (chunk: string) => { 
                    sendEvent(res, 'text', { content: chunk });
                    // Persist content chunk
                    await sessionService.updateMessage(sessionId, assistantMsgId, { content: chunk });
                },
                onPlanProposed: async (plan: Plan) => {
                    sendEvent(res, 'plan', { plan });
                    await sessionService.updateMessage(sessionId, assistantMsgId, { plan, isAwaitingApproval: true });
                },
                onChartData: async (data: ChartData) => {
                    sendEvent(res, 'chart', { data });
                    const current = await sessionService.getSession(sessionId);
                    if (current) {
                        const msg = current.uiMessages.find(m => m.id === assistantMsgId);
                        if (msg) {
                            msg.charts = [...(msg.charts || []), data];
                            await sessionService.saveSession(sessionId, current);
                        }
                    }
                },
                onFilesWritten: async (paths: string[]) => {
                    sendEvent(res, 'files', { paths });
                    const current = await sessionService.getSession(sessionId);
                    if (current) {
                        const msg = current.uiMessages.find(m => m.id === assistantMsgId);
                        if (msg) {
                            msg.writtenFiles = [...(msg.writtenFiles || []), ...paths];
                            await sessionService.saveSession(sessionId, current);
                        }
                    }
                },
                onPlanStepUpdate: async (msgId: string, stepId: string, status: "in_progress" | "completed") => {
                    sendEvent(res, 'planUpdate', { msgId: msgId || assistantMsgId, stepId, status });
                    const targetId = msgId || assistantMsgId;
                    const current = await sessionService.getSession(sessionId);
                    if (current) {
                        const msg = current.uiMessages.find(m => m.id === targetId);
                        if (msg && msg.plan) {
                            msg.plan.steps = msg.plan.steps.map(s => s.id === stepId ? { ...s, status } : s);
                            await sessionService.saveSession(sessionId, current);
                        }
                    }
                }
            },
            {
                resumePlan: params?.resumePlan,
                isApprovalConfirmed: params?.isApprovalConfirmed,
                planMsgId: params?.planMsgId,
                options: params?.options
            }
        );
        
        // Finalize
        sendEvent(res, 'done', {});
        res.end();

    } catch (err: any) {
        console.error(err);
        sendEvent(res, 'error', { message: err.message });
        res.end();
    }
};

export default {
    chatStream
};
