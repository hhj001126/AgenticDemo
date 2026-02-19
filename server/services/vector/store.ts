import fs from 'fs-extra';
import path from 'path';
import { KnowledgeChunk } from '../../../types'; // Ensure types definition is available server-side
import { DATA_DIR } from '../../config';

const VECTOR_STORE_FILE = path.join(DATA_DIR, 'vector_store.json');

export interface VectorStoreState {
  chunks: KnowledgeChunk[];
  updatedAt: number;
}

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

function load(): VectorStoreState {
  try {
    if (!fs.existsSync(VECTOR_STORE_FILE)) return { chunks: [], updatedAt: 0 };
    return fs.readJsonSync(VECTOR_STORE_FILE);
  } catch {
    return { chunks: [], updatedAt: 0 };
  }
}

function save(state: VectorStoreState): void {
  fs.writeJsonSync(VECTOR_STORE_FILE, state, { spaces: 2 });
}

export const vectorStoreService = {
  getChunks(): KnowledgeChunk[] {
    return load().chunks;
  },

  addChunks(chunks: KnowledgeChunk[]): void {
    const state = load();
    // Simple push, in real app might want deduplication
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
    
    // Simple keyword extraction
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
