import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from '../../config';

const TOOL_CONFIG_FILE = path.join(DATA_DIR, 'tool_config.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

function loadMap(): Record<string, boolean> {
  try {
    if (!fs.existsSync(TOOL_CONFIG_FILE)) return {};
    return fs.readJsonSync(TOOL_CONFIG_FILE);
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, boolean>): void {
  fs.writeJsonSync(TOOL_CONFIG_FILE, map, { spaces: 2 });
}

export const toolManagerService = {
  getToolEnabled: (toolId: string): boolean => {
    const map = loadMap();
    if (!(toolId in map)) return true; // Default to true if not set
    return !!map[toolId];
  },

  setToolEnabled: (toolId: string, enabled: boolean): void => {
    const map = loadMap();
    map[toolId] = enabled;
    saveMap(map);
  },
  
  getAll: (): Record<string, boolean> => {
      return loadMap();
  }
};
