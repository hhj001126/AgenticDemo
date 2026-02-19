import type { FunctionDeclaration } from "@google/genai";
import { Type } from "@google/genai";

export interface ToolDefinition {
  definition: FunctionDeclaration;
  executor: (args: any, sessionId: string, onProgress?: (content: string) => void) => Promise<any>;
  blocking?: boolean;
  source?: string;
}

const registry = new Map<string, ToolDefinition>();

export const toolRegistry = {
  register: (name: string, tool: ToolDefinition, source?: string) => {
    registry.set(name, { ...tool, source });
  },
  
  get: (name: string) => registry.get(name),
  
  getDefinitions: () => Array.from(registry.values()).map(t => t.definition),
  
  execute: async (name: string, args: any, sessionId: string, onProgress?: (content: string) => void) => {
    const tool = registry.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.executor(args, sessionId, onProgress);
  },
  
  isBlocking: (name: string) => registry.get(name)?.blocking ?? false,
  
  unregister: (name: string) => {
      registry.delete(name);
  },

  unregisterBySource: (source: string, filter?: (name: string) => boolean) => {
      for (const [name, tool] of registry.entries()) {
          if (tool.source === source) {
              if (!filter || filter(name)) {
                  registry.delete(name);
              }
          }
      }
  },

  getBlockingIds: () => {

      const ids = new Set<string>();
      for (const [name, tool] of registry.entries()) {
          if (tool.blocking) ids.add(name);
      }
      return ids;
  }
};
