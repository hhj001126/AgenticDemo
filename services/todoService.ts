/**
 * 待办/提醒服务：localStorage 持久化
 */
const STORAGE_KEY = "agent_todos";

export interface TodoItem {
  id: string;
  title: string;
  dueAt?: string;
  priority?: "low" | "medium" | "high";
  completed: boolean;
  createdAt: number;
}

function load(): TodoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: TodoItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function genId(): string {
  return "todo_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const todoService = {
  list(includeCompleted = false): TodoItem[] {
    const items = load();
    return includeCompleted ? items : items.filter((t) => !t.completed);
  },

  add(title: string, dueAt?: string, priority?: "low" | "medium" | "high"): TodoItem {
    const items = load();
    const item: TodoItem = {
      id: genId(),
      title,
      dueAt,
      priority,
      completed: false,
      createdAt: Date.now(),
    };
    items.push(item);
    save(items);
    return item;
  },

  complete(id: string): boolean {
    const items = load();
    const idx = items.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    items[idx].completed = true;
    save(items);
    return true;
  },

  remove(id: string): boolean {
    const items = load().filter((t) => t.id !== id);
    save(items);
    return true;
  },
};
