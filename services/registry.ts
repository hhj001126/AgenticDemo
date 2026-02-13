/**
 * 统一注册中心：Tools / Functions / SubAgents
 * 用户可通过标准化接口注册自定义工具或子代理
 */
import { Type, FunctionDeclaration } from "@google/genai";
import { toolEnableService } from "./toolEnableService";
import type {
  ToolDefinition,
  SubAgentDefinition,
  RegistrySource,
  ToolRegistrationSpec,
  SubAgentRegistrationSpec,
} from "../types";

export interface RegistryEntry<T> {
  item: T;
  source: RegistrySource;
  registeredAt: number;
}

/** 工具注册表 */
const toolRegistry = new Map<string, RegistryEntry<ToolDefinition>>();

/** 子代理注册表 */
const subAgentRegistry = new Map<string, RegistryEntry<SubAgentDefinition>>();

/** 阻塞式工具：Supervisor 必须等待完成才能继续 */
const BLOCKING_TOOL_IDS = new Set<string>(["analyze_requirements", "propose_plan"]);

/** 工具注册中心 */
export const toolRegistryService = {
  /** 注册工具 */
  register(
    id: string,
    tool: ToolDefinition,
    source: RegistrySource = "user"
  ): void {
    if (toolRegistry.has(id)) {
      console.warn(`[Registry] Tool "${id}" already exists, overwriting`);
    }
    toolRegistry.set(id, {
      item: tool,
      source,
      registeredAt: Date.now(),
    });
  },

  /** 取消注册 */
  unregister(id: string): boolean {
    return toolRegistry.delete(id);
  },

  /** 获取单个工具 */
  get(id: string): ToolDefinition | null {
    return toolRegistry.get(id)?.item ?? null;
  },

  /** 获取所有工具定义（用于 Gemini tools 配置） */
  getDefinitions(): FunctionDeclaration[] {
    return Array.from(toolRegistry.values()).map((e) => e.item.definition);
  },

  /** 获取所有注册项（含 executor） */
  getAll(): Map<string, ToolDefinition> {
    const m = new Map<string, ToolDefinition>();
    for (const [id, entry] of toolRegistry) {
      m.set(id, entry.item);
    }
    return m;
  },

  /** 获取所有工具及来源（供 UI 展示 builtin/user） */
  getAllWithSource(): Array<{ id: string; tool: ToolDefinition; source: RegistrySource }> {
    return Array.from(toolRegistry.entries()).map(([id, entry]) => ({
      id,
      tool: entry.item,
      source: entry.source,
    }));
  },

  /** 是否阻塞式工具 */
  isBlocking(id: string): boolean {
    const tool = toolRegistry.get(id)?.item;
    return tool?.blocking ?? BLOCKING_TOOL_IDS.has(id);
  },

  /** 获取阻塞式工具 ID 集合 */
  getBlockingIds(): Set<string> {
    const ids = new Set(BLOCKING_TOOL_IDS);
    for (const [id, entry] of toolRegistry) {
      if (entry.item.blocking) ids.add(id);
    }
    return ids;
  },

  /** 执行工具 */
  async execute(
    id: string,
    args: Record<string, unknown>,
    sessionId: string,
    onProgress?: (content: string) => void
  ): Promise<unknown> {
    if (!toolEnableService.getToolEnabled(id)) {
      return { error: "ToolDisabled", id };
    }
    const tool = toolRegistry.get(id)?.item;
    if (!tool) return { error: "ToolNotFound", id };
    return tool.executor(args, sessionId, onProgress);
  },
};

/** 子代理注册中心 */
export const subAgentRegistryService = {
  register(id: string, agent: SubAgentDefinition, source: RegistrySource = "user"): void {
    if (subAgentRegistry.has(id)) {
      console.warn(`[Registry] SubAgent "${id}" already exists, overwriting`);
    }
    subAgentRegistry.set(id, {
      item: agent,
      source,
      registeredAt: Date.now(),
    });
  },

  unregister(id: string): boolean {
    return subAgentRegistry.delete(id);
  },

  get(id: string): SubAgentDefinition | null {
    return subAgentRegistry.get(id)?.item ?? null;
  },

  getAll(): Map<string, SubAgentDefinition> {
    const m = new Map<string, SubAgentDefinition>();
    for (const [id, entry] of subAgentRegistry) {
      m.set(id, entry.item);
    }
    return m;
  },
};

/** 从用户规范注册工具（统一标准） */
export function registerToolFromSpec(spec: ToolRegistrationSpec, source: RegistrySource = "user"): void {
  const props: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, p] of Object.entries(spec.parameters)) {
    const typeVal = (Type as any)[p.type.toUpperCase()] ?? Type.STRING;
    props[key] = { type: typeVal, description: p.description };
    if (p.items) (props[key] as any).items = p.items;
    if (p.enum) (props[key] as any).enum = p.enum;
    if (p.required) required.push(key);
  }
  toolRegistryService.register(
    spec.id,
    {
      definition: {
        name: spec.id,
        description: spec.description,
        parameters: { type: Type.OBJECT, properties: props, required: required.length ? required : undefined },
      },
      executor: spec.executor,
      blocking: spec.blocking,
    },
    source
  );
}

/** 从用户规范注册子代理（统一标准） */
export function registerSubAgentFromSpec(
  spec: SubAgentRegistrationSpec,
  source: RegistrySource = "user"
): void {
  subAgentRegistryService.register(
    spec.id,
    {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      systemPrompt: spec.systemPrompt,
      userPrompt: spec.userPrompt,
      outputSchema: spec.outputSchema,
    },
    source
  );
}

/** 注册标准：用于创建 FunctionDeclaration 的辅助 */
export const createToolDefinition = (
  name: string,
  description: string,
  params: Record<string, { type: string; description?: string; required?: boolean; items?: object; enum?: string[] }>,
  blocking = false
): { definition: FunctionDeclaration; blocking: boolean } => {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, spec] of Object.entries(params)) {
    const prop: any = { type: (Type as any)[spec.type.toUpperCase()] ?? Type.STRING, description: spec.description };
    if (spec.items) prop.items = spec.items;
    if (spec.enum) prop.enum = spec.enum;
    properties[key] = prop;
    if (spec.required) required.push(key);
  }
  return {
    definition: {
      name,
      description,
      parameters: {
        type: Type.OBJECT,
        properties,
        required: required.length ? required : undefined,
      },
    },
    blocking,
  };
};
