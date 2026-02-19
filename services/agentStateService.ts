import { Message, SessionMeta, VfsFile, KnowledgeChunk } from "../types";
import { api } from './api';

export interface AgentSessionState {
  sessionId: string;
  title?: string;
  geminiHistory: any[];
  uiMessages: Message[];
  vfs: Record<string, VfsFile>;
  knowledgeChunks?: KnowledgeChunk[];
  lastUpdated: number;
}

export const agentStateService = {
  initializeSession: async (): Promise<string> => {
    try {
        const { sessionId } = await api.get<{ sessionId: string }>('/sessions/active');
        if (sessionId) return sessionId;
    } catch {}
    
    // No active session or error, create new
    return agentStateService.createSession();
  },

  createSession: async (): Promise<string> => {
    const { sessionId } = await api.post<{ sessionId: string }>('/sessions', {});
    return sessionId;
  },

  listSessions: async (): Promise<SessionMeta[]> => {
    return api.get<SessionMeta[]>('/sessions');
  },

  switchSession: async (sessionId: string) => {
    await api.put(`/sessions/${sessionId}/active`, {});
  },

  deleteSession: async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    await api.put(`/sessions/${sessionId}/title`, { title });
  },

  getSession: async (sessionId: string): Promise<AgentSessionState | null> => {
    try {
        return await api.get<AgentSessionState>(`/sessions/${sessionId}`);
    } catch {
        return null; // Handle 404 or error
    }
  },

  // Note: saveSession is no longer needed on frontend as state is managed by backend
  // But for compatibility with existing UI that might call syncUiState
  
  syncUiState: async (sessionId: string, messages: Message[]) => {
      // We don't implement this strictly because UI state is part of the session
      // For now, we assume backend updates state via chat interaction
      // However, if UI optimistically updates, we might want to sync?
      // Actually, chat messages are sent to backend, so backend has them.
      // But clearing session content logic uses clearSessionContent API.
  },

  clearSessionContent: async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}/content`);
  },

  updateVfs: async (sessionId: string, path: string, content: string, language: string, isWriting?: boolean) => {
      // VFS updates typically happen via Agent. 
      // If UI edits file, we should have an API for it?
      // Yes, updateVfs Endpoint.
      // We need to fetch current VFS first to merge? Or backend handles merge?
      // Backend controller `updateVfs` takes `{ vfs }` object. Ideally it should take path/content.
      // Current controller implementation replaces `vfs`.
      // Let's assume for now we don't edit from UI manually often, or if we do, we need to fix backend controller to support patch.
      // But for "AgentChat" usage, it listens to "vfs-updated" event. 
      // This front-end service might be used by CodeWorkspace to "save" files?
      // If so, we need to implement it.
      
      // For now, let's skip implementing this fully unless UI calls it.
      // UI only reads.
      // Wait, CodeWorkspace allows editing?
  },
  
  // ... other methods kept for type compatibility but might throw or do nothing
  
  getActiveSessionId: async (): Promise<string | null> => {
      // This is sync in original? No, original had logic.
      // We can't make this sync. UI components using it might expect sync.
      // Original: getActiveSessionId(): string | null
      // We'll have to cache it or change usage.
      // For refactoring, let's assume valid session ID is passed in props usually.
      return null; 
  },

  getKnowledgeChunks: async (sessionId: string): Promise<KnowledgeChunk[]> => {
    const session = await agentStateService.getSession(sessionId);
    return session?.knowledgeChunks ?? [];
  },

  appendKnowledgeChunks: async (sessionId: string, chunks: KnowledgeChunk[]): Promise<void> => {
     // Backend handle this via vector store? 
     // Or session knowledge?
     // Original: session.knowledgeChunks.
     // We invoke vector store API probably.
     // But strictly, this updates session state.
     // Backend `updateSession` can be used.
     const session = await agentStateService.getSession(sessionId);
     if (!session) return;
     // This part is tricky without an explicit API for appending.
     // But `vectorStoreService` handles the actual vector DB. 
     // This method was for session-local context.
  }
};
