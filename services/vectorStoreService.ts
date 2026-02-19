/**
 * 向量库最小实现：localStorage + 简单全文匹配
 * Phase 1：无真实向量，使用关键词匹配
 */
import type { KnowledgeChunk } from "../types";

const STORAGE_KEY = "agent_vector_store";

export interface VectorStoreState {
  chunks: KnowledgeChunk[];
  updatedAt: number;
}

function load(): VectorStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chunks: [], updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return { chunks: [], updatedAt: 0 };
  }
}

function save(state: VectorStoreState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const vectorStoreService = {
  getChunks(): KnowledgeChunk[] {
    return load().chunks;
  },

  addChunks(chunks: KnowledgeChunk[]): void {
    const state = load();
    state.chunks.push(...chunks);
    state.updatedAt = Date.now();
    save(state);
  },

  clear(): void {
    save({ chunks: [], updatedAt: Date.now() });
  },

  /** 简单全文检索：关键词匹配，返回相关性排序的 chunks */
  search(query: string, limit = 10): KnowledgeChunk[] {
    const { chunks } = load();
    if (chunks.length === 0) return [];
    const keywords = query
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const scored = chunks.map((c) => {
      let score = 0;
      const text = `${c.content} ${c.summary}`.toLowerCase();
      const qLower = query.toLowerCase();
      if (text.includes(qLower)) score += 10;
      for (const kw of keywords) {
        if (kw.length > 1 && text.includes(kw.toLowerCase())) score += 2;
      }
      return { chunk: c, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.chunk);
  },
};
