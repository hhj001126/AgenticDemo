import { api } from './api';

export const toolEnableService = {
  getToolEnabled: async (toolId: string): Promise<boolean> => {
    try {
        const res = await api.get<{ enabled: boolean }>(`/tools/${toolId}`);
        return res.enabled;
    } catch {
        return true;
    }
  },

  setToolEnabled: async (toolId: string, enabled: boolean): Promise<void> => {
    await api.put(`/tools/${toolId}`, { enabled });
  },

  getAllTools: async (): Promise<Record<string, boolean>> => {
      return api.get<Record<string, boolean>>('/tools');
  },

  getToolDefinitions: async (): Promise<any[]> => {
      return api.get<any[]>('/tools/definitions');
  }
};
