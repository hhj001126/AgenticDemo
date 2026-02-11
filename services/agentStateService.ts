
import { Message } from "../types";

export interface AgentSessionState {
  sessionId: string;
  geminiHistory: any[]; // Stores the LLM conversation history (Content objects)
  uiMessages: Message[]; // Stores the frontend UI message history
  lastUpdated: number;
}

const STORAGE_KEY_ACTIVE = 'agent_session_active';
const STORAGE_PREFIX = 'agent_session_data_';

export const agentStateService = {
  /**
   * Initialize or retrieve the active session ID.
   * Ensures a session always exists on app boot.
   */
  initializeSession: (): string => {
    let activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (!activeId) {
      activeId = agentStateService.createSession();
    }
    return activeId;
  },

  /**
   * Create a fresh session and set it as active.
   */
  createSession: (): string => {
    const newId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    localStorage.setItem(STORAGE_KEY_ACTIVE, newId);
    
    const initialState: AgentSessionState = {
      sessionId: newId,
      geminiHistory: [],
      uiMessages: [],
      lastUpdated: Date.now()
    };
    
    try {
      localStorage.setItem(STORAGE_PREFIX + newId, JSON.stringify(initialState));
    } catch (e) {
      console.error("Failed to initialize session storage", e);
    }
    return newId;
  },

  /**
   * Retrieve full state for a given session.
   */
  getSession: (sessionId: string): AgentSessionState | null => {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("State corruption detected for session " + sessionId, e);
      return null;
    }
  },

  /**
   * Update specific fields of the session state.
   */
  saveSession: (sessionId: string, updates: Partial<AgentSessionState>) => {
    const current = agentStateService.getSession(sessionId);
    if (!current) return;
    
    const updatedState = {
      ...current,
      ...updates,
      lastUpdated: Date.now()
    };
    
    try {
      localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(updatedState));
    } catch (e) {
      console.error("Quota exceeded or storage error", e);
    }
  },

  /**
   * Clear a specific session and reset active pointer if needed.
   */
  clearSession: (sessionId: string) => {
    localStorage.removeItem(STORAGE_PREFIX + sessionId);
    if (localStorage.getItem(STORAGE_KEY_ACTIVE) === sessionId) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  },
  
  /**
   * Compress the session history to only retain text messages (User Q & Model A).
   * Removes all Tool Calls and Tool Responses to save tokens and clean context.
   */
  clearSessionContext: (sessionId: string) => {
    const current = agentStateService.getSession(sessionId);
    if (!current || !current.geminiHistory) return;

    // Filter to keep only parts that have 'text'
    // This effectively removes FunctionCall and FunctionResponse parts
    const cleanHistory = current.geminiHistory.map((msg: any) => {
      if (!msg.parts) return null;
      
      const textParts = msg.parts.filter((p: any) => p.text);
      if (textParts.length === 0) return null;
      
      return { role: msg.role, parts: textParts };
    }).filter(Boolean);

    agentStateService.saveSession(sessionId, { geminiHistory: cleanHistory });
  },

  /**
   * Helper to sync just the UI messages (called from React components).
   */
  syncUiState: (sessionId: string, messages: Message[]) => {
      agentStateService.saveSession(sessionId, { uiMessages: messages });
  }
};
