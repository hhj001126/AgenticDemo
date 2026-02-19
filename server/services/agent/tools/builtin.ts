import { ToolDefinition } from '../registry';
import { sessionService } from '../state';
import { vectorStoreService } from '../../vector/store';
import { chunkerService } from '../../chunk/chunker';
import { toolManagerService } from '../../tools/manager';
import { Type } from '@google/genai';

// Helper to update VFS and broadcast
const updateVfs = async (sessionId: string, path: string, content: string, language: string) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    
    // Simple VFS implementation using session state
    // In a real app, might want to write to actual disk too or just keep in DB/JSON
    const vfs = session.vfs || {};
    vfs[path] = { path, content, language, isWriting: false };
    
    await sessionService.updateSession(sessionId, { vfs });
    // In a real backend, we might emit a socket event here if we had sockets
};

export const registerBuiltinTools = () => {
  const { toolRegistry } = require('../registry');

  // --- File Operations ---
  toolRegistry.register('read_file', {
    definition: {
      name: 'read_file',
      description: '读取虚拟文件系统中的文件内容',
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: '文件路径' }
        },
        required: ['path']
      }
    },
    executor: async ({ path }: { path: string }, sessionId: string) => {
      const session = await sessionService.getSession(sessionId);
      if (!session || !session.vfs || !session.vfs[path]) {
        return { error: `File not found: ${path}` };
      }
      return { content: session.vfs[path].content };
    }
  });

  toolRegistry.register('write_file', {
    definition: {
      name: 'write_file',
      description: '创建或覆盖文件内容。支持 Markdown/代码/文本',
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: '文件路径' },
          content: { type: Type.STRING, description: '文件内容' },
          language: { type: Type.STRING, description: '编程语言（如 typescript, markdown）', nullable: true }
        },
        required: ['path', 'content']
      }
    },
    executor: async ({ path, content, language }: { path: string, content: string, language?: string }, sessionId: string) => {
      await updateVfs(sessionId, path, content, language || 'plaintext');
      return { path, status: 'success' };
    }
  });

  toolRegistry.register('list_files', {
      definition: {
          name: 'list_files',
          description: '列出当前工作区的所有文件',
          parameters: {
              type: Type.OBJECT,
              properties: {},
          }
      },
      executor: async (_: any, sessionId: string) => {
          const session = await sessionService.getSession(sessionId);
          if (!session || !session.vfs) return [];
          return Object.keys(session.vfs);
      }
  });

  // --- Knowledge & Search ---
  toolRegistry.register('search_knowledge', {
      definition: {
          name: 'search_knowledge',
          description: '在知识库中搜索相关内容',
          parameters: {
              type: Type.OBJECT,
              properties: {
                  query: { type: Type.STRING, description: '搜索关键词或问题' }
              },
              required: ['query']
          }
      },
      executor: async ({ query }: { query: string }, sessionId: string) => {
          // Use vector store service
          const results = vectorStoreService.search(query);
          return { results };
      }
  });

  // --- Planning ---
  toolRegistry.register('propose_plan', {
      definition: {
          name: 'propose_plan',
          description: '针对复杂任务生成多步骤执行计划',
          parameters: {
              type: Type.OBJECT,
              properties: {
                  userRequest: { type: Type.STRING, description: '用户的完整原始请求' },
                  industry: { type: Type.STRING, description: '当前行业背景' }
              },
              required: ['userRequest']
          }
      },
      blocking: true,
      executor: async (args: any, sessionId: string) => {
          // In backend, we might call another Gemini instance or just return struct
          // For now, let's just return a placeholder or simple logic
          // Real implementation: Call `proposePlanAgent` (another model call)
          // To keep it simple for now, we'll return a basic plan or simulate
          
          // Actual logic: use Gemini to generate plan JSON
          // We can reuse supervisor prompt's plan logic or a separate call.
          // Let's implement a simple plan generation using the same model for now
          // or just return the args to let the supervisor "hallucinate" the plan?
          // No, the tool executor MUST return the plan object.
          
          // Let's import the PROPOSE_PLAN_SYSTEM prompts and call Gemini
          const { PROPOSE_PLAN_SYSTEM, PROPOSE_PLAN_USER } = require('../prompts'); // Lazy import
          const { GoogleGenAI } = require('@google/genai');
          const { GEMINI_API_KEY } = require('../../config');
          
          const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash',
              contents: [{
                  role: 'user',
                  parts: [{ text: PROPOSE_PLAN_SYSTEM(args.industry || 'General') + '\n' + PROPOSE_PLAN_USER(args.userRequest) }]
              }],
              config: { responseMimeType: 'application/json' }
          });
          
          try {
              const plan = JSON.parse(response.text || '{}');
              return { plan };
          } catch {
              return { error: 'Failed to generate plan JSON' };
          }
      }
  });
  
  toolRegistry.register('report_step_done', {
      definition: {
          name: 'report_step_done',
          description: '报告当前计划步骤已完成',
          parameters: {
              type: Type.OBJECT,
              properties: {
                  stepId: { type: Type.STRING, description: '已完成的步骤 ID' }
              },
              required: ['stepId']
          }
      },
      executor: async ({ stepId }: { stepId: string }) => {
          return { status: 'recorded', stepId };
      }
  });

  // --- Utils ---
  toolRegistry.register('create_todo', {
      definition: { name: 'create_todo', description: '创建待办项', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING } } } },
      executor: async ({ title }: { title: string }) => ({ status: 'created', id: Date.now() })
  });
  
  toolRegistry.register('list_todos', {
      definition: { name: 'list_todos', description: '列出所有待办', parameters: { type: Type.OBJECT, properties: {} } },
      executor: async () => ({ todos: [] }) // Mock
  });
  
  toolRegistry.register('complete_todo', {
      definition: { name: 'complete_todo', description: '完成待办', parameters: { type: Type.OBJECT, properties: { id: { type: Type.STRING } } } },
      executor: async () => ({ status: 'completed' })
  });

  // --- Analysis ---
  toolRegistry.register('analyze_requirements', {
      definition: {
          name: 'analyze_requirements',
          description: '深度分析用户需求',
          parameters: {
              type: Type.OBJECT,
              properties: {
                  context: { type: Type.STRING },
                  domain: { type: Type.STRING }
              },
              required: ['context']
          }
      },
      blocking: true,
      executor: async ({ context, domain }: { context: string, domain: string }) => {
           // Simple mock or real call
           return { analysis: `Analyzed: ${context.slice(0, 50)}...` };
      }
  });

  // --- Charts ---
  toolRegistry.register('generate_chart', {
      definition: {
          name: 'generate_chart',
          description: '生成图表配置',
          parameters: {
              type: Type.OBJECT,
              properties: {
                  type: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'doughnut'] },
                  title: { type: Type.STRING },
                  labels: { type: Type.ARRAY, items: { type: Type.STRING } },
                  datasets: { 
                      type: Type.ARRAY, 
                      items: { 
                          type: Type.OBJECT,
                          properties: {
                              label: { type: Type.STRING },
                              data: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                          }
                      } 
                  }
              },
              required: ['type', 'data']
          }
      },
      executor: async (args: any) => {
          // Just return the args to frontend to render
          return args;
      }
  });
};
