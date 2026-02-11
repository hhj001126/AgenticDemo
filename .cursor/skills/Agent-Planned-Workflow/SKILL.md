---
name: agent-planned-workflow
description: Guides multi-step Agent tasks with plan proposal and user approval. Use when implementing tasks that involve multiple phases (query, compute, write file), when the user mentions plan/proposal/approval, or when adding new Agent workflows.
---

# Agent 计划编排工作流

## 核心原则

**先提议计划，获得确认后再执行写操作。**

## 执行步骤

1. **propose_plan 调用（子代理）**：
   - 任务涉及多步骤时调用，传入 `userRequest`（用户请求摘要）及可选 `industry`
   - 子代理通过 AI 生成计划并流式输出，最终返回 `{ plan: { title, steps } }`
   - 单步或简单请求勿调用

2. **计划数据结构**：
   ```ts
   steps: [{ id, task, status: 'pending', requiresApproval, parallel, approved, isAutoApproved }]
   isApproved: false  // 待用户确认
   ```

3. **UI 审批**：
   - `isAwaitingApproval` 为 true 时展示计划确认界面
   - 需审批步骤可勾选，`onConfirm` 后设置 `isApproved: true`
   - 自动批准步骤：`requiresApproval: false`，`isAutoApproved: true`

4. **执行阶段**：
   - 仅在 `plan.isApproved === true` 后执行写操作
   - 禁止未获确认直接调用写文件、数据库写入等工具

5. **ThinkingStep 与计划联动**：
   - 计划提议、审批、执行各阶段可对应不同 `ThinkingStep` 状态
   - 用户可见：`pending` → `active` → `completed` 或 `failed`
