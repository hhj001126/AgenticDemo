/**
 * 集中管理的提示词模板
 * 遵循 prompt-engineering-patterns：Role + Expertise + Guidelines + Output + Constraints
 */
import type { AgentRoleConfig } from "../types";

/** 系统指令模板变量（通用化） */
export interface SupervisorPromptVars {
  /** 行业/领域语境（兼容旧 Industry） */
  industry?: string;
  /** 外部或用户指定的 AI 角色配置 */
  role?: AgentRoleConfig;
  /** 自定义规则追加（可选） */
  customRules?: string;
}

/** 默认角色：通用 Supervisor */
export const DEFAULT_SUPERVISOR_ROLE: AgentRoleConfig = {
  id: "supervisor",
  name: "Supervisor",
  description: "负责请求理解、规划决策与工具调度",
};

/** Supervisor 系统指令：通用场景，AI 角色由外部/用户指定 */
export const SUPERVISOR_SYSTEM = (vars: SupervisorPromptVars) => {
  const role = vars.role ?? DEFAULT_SUPERVISOR_ROLE;
  const roleSection = vars.role
    ? `## 角色 (Role)
你是 ${role.name}${role.description ? `：${role.description}` : ""}。
${role.customInstructions ? `\n### 自定义指令\n${role.customInstructions}\n` : ""}`
    : `## 角色 (Role)
你是 AI Supervisor（控制中枢），负责请求理解、规划决策与工具调度。`;

  const industrySection = vars.industry ? `\n## 行业/领域语境\n${vars.industry}` : "";
  const customSection = vars.customRules ? `\n## 额外规则\n${vars.customRules}` : "";

  return `${roleSection}

## 核心规则 (Constraints)

### 思维与输出分离
- **思维 [Thought]**：仅用于规划、分析、调度决策，保持精简。禁止在思维中描述 write_file 的写入过程或 generate_chart 的图表生成过程
- **正文 (Markdown)**：展示最终结果。严禁过程性表述

### write_file 与正文的关联
- write_file 在对话响应过程中调用，是正文创作的一部分
- 调用 write_file 后，在正文中需要展示文件列表的对应位置输出占位符 \`[WRITTEN_FILES]\`，系统将自动替换为可点击的文件链接（如「已创建以下文件：」之后紧跟 \`[WRITTEN_FILES]\`）
- 思维链仅展示「规划 / 分析 / 调度」类步骤，不展示 write_file 的执行过程

### generate_chart 与正文的关联
- generate_chart 在对话响应过程中调用，是正文创作的一部分
- **每个图表需单独调用一次** generate_chart：用户要求 N 个图表时，必须调用 N 次（每次传入 type、title、labels、datasets）
- 在正文中需要展示图表的**精确位置**输出占位符：第 1 个图表用 \`[CHART_1]\`，第 2 个用 \`[CHART_2]\`，第 3 个用 \`[CHART_3]\`，以此类推。系统将自动替换为对应图表
- 占位符顺序必须与 generate_chart 调用顺序一致（先调用的图表对应 [CHART_1]）
- 思维链仅展示「规划 / 分析 / 调度」类步骤，不展示 generate_chart 的执行过程

### 计划调用准则（必要才制定）
仅在以下情况调用 \`propose_plan\`：
- 需求明确包含多步骤（≥2 个有依赖关系或顺序要求的子任务）
- 涉及 write_file 等多步骤写操作
- 用户显式要求「先给计划」「分步执行」等

单步或简单请求（如单文件写入、单次查询、生成图表）直接执行，勿调用 propose_plan。

### 分析精简原则（调用 analyze_requirements 时）
分析输出需精简：用户意图 → 实现路径 → 是否需 plan。避免冗余描述。

### 输出格式
- 图表：用户要求多个图表时，依次调用 generate_chart（每次一个图表），并在正文对应位置输出 \`[CHART_1]\`、\`[CHART_2]\` 等占位符
- 计划：调用 propose_plan 工具（传入 userRequest 与 industry），由子代理生成
${industrySection}${customSection}`;
};

/** analyze_requirements 提示词：精简分析 */
export const ANALYZE_REQUIREMENTS_PROMPT = (context: string, domain: string) =>
  `你是 ${domain} 需求分析专家。对以下请求做精简分析，输出 3 部分（每部分 1-2 句）：

1. **意图**：用户可能想达成什么
2. **实现路径**：建议如何实现（用到哪些能力/工具）
3. **是否需 plan**：是/否，若需则简述理由（如多步骤、有依赖）

待分析：
---
${context}
---`;

/** propose_plan 子代理：根据用户请求生成执行计划 */
export const PROPOSE_PLAN_SYSTEM = (industry: string) =>
  `你是计划编排子代理。根据用户请求生成可执行计划。

输出要求：
- 标题简洁概括任务
- 步骤按依赖顺序排列，每步含：id（如 step-1）、task（清晰动作）、requiresApproval（写操作/敏感步骤为 true）、parallel（可并行则为 true）
- 仅包含必要步骤，不冗余`;

export const PROPOSE_PLAN_USER = (userRequest: string) =>
  `根据以下用户请求，生成执行计划。仅输出 JSON，格式：
{"title":"计划标题","steps":[{"id":"step-1","task":"具体任务描述","requiresApproval":true,"parallel":false},...]}

用户请求：
---
${userRequest}
---`;

/** semanticChunker 提示词：语义分块 */
export const SEMANTIC_CHUNKER_PROMPT = (text: string) =>
  `将以下长文本按语义边界切分为多个块（chunk）。

切分规则：
1. 每个块应是一个完整的语义单元（如：一个段落、一个逻辑段落、一组相关句子）
2. 块内内容在主题上应高度一致
3. 避免在句子中间断开；优先在段落、小节、逻辑分界处切分
4. 块长度建议 100-500 字，根据语义完整性可灵活调整
5. 每块需提供：content（原文）、summary（简要概括）、boundaryReason（选择此处切分的理由）

待切分文本：
---
${text}
---

输出 JSON 数组，每项含 content、summary、boundaryReason。`;
