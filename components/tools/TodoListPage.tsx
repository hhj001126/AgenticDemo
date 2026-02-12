import React, { useState, useCallback, useEffect } from "react";
import { ListTodo, Check, Trash2 } from "lucide-react";
import { PageContainer, Card, Button, Flex, useConfirm } from "../ui";
import { todoService, type TodoItem } from "../../services/todoService";
import { cn } from "../../utils/classnames";

export default function TodoListPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const confirm = useConfirm();

  const refresh = useCallback(() => {
    setTodos(todoService.list(showCompleted));
  }, [showCompleted]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleComplete = (id: string) => {
    todoService.complete(id);
    refresh();
  };

  const handleRemove = async (id: string) => {
    const item = todos.find((t) => t.id === id);
    const ok = await confirm({
      title: "删除待办",
      message: `确定要删除「${item?.title ?? id}」吗？`,
      danger: true,
      confirmText: "删除",
      cancelText: "取消",
    });
    if (!ok) return;
    todoService.remove(id);
    refresh();
  };

  const today = todos.filter((t) => {
    if (!t.dueAt || t.completed) return false;
    const due = new Date(t.dueAt);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });

  return (
    <PageContainer padding="lg">
      <Flex direction="col" gap={6}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
              <ListTodo size={24} className="text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text font-display">今日待办</h1>
              <p className="text-sm text-text-muted">
                可在对话中创建、查询、完成待办；此处管理全部待办
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            显示已完成
          </label>
        </div>

        {today.length > 0 && !showCompleted && (
          <Card padding="md" className="border-primary-200 bg-primary-50/30">
            <h3 className="text-sm font-bold text-primary mb-3">今日截止 ({today.length})</h3>
            <div className="space-y-2">
              {today.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-surface border border-border"
                >
                  <span className="text-sm text-text-secondary flex-1">{t.title}</span>
                  <span className="text-xs text-text-muted">{t.dueAt?.slice(0, 16)}</span>
                  <Button variant="primary" size="sm" onClick={() => handleComplete(t.id)}>
                    <Check size={14} />
                    完成
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card padding="none" className="border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border-muted bg-surface-muted/40">
            <h3 className="font-bold text-text-secondary">全部待办 ({todos.length})</h3>
          </div>
          <div className="divide-y divide-border-muted">
            {todos.length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <ListTodo size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无待办</p>
                <p className="text-xs mt-1">在对话中说「帮我记一下 xxx」即可创建</p>
              </div>
            ) : (
              todos.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 px-5 py-4 hover:bg-surface-muted/30 transition-colors",
                    t.completed && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => !t.completed && handleComplete(t.id)}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
                      t.completed
                        ? "bg-primary border-primary text-white"
                        : "border-border hover:border-primary cursor-pointer"
                    )}
                  >
                    {t.completed && <Check size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", t.completed && "line-through text-text-muted")}>
                      {t.title}
                    </p>
                    {(t.dueAt || t.priority) && (
                      <p className="text-xs text-text-muted mt-0.5">
                        {t.dueAt && <span>{t.dueAt.slice(0, 16)}</span>}
                        {t.priority && <span className="ml-2">优先级: {t.priority}</span>}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="icon"
                    size="sm"
                    onClick={() => handleRemove(t.id)}
                    className="text-text-muted hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </Flex>
    </PageContainer>
  );
}
