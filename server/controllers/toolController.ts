import { Request, Response } from 'express';
import { toolManagerService } from '../services/tools/manager';
import { toolRegistry } from '../services/agent/registry';

export const getToolEnabled = (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const enabled = toolManagerService.getToolEnabled(toolId);
    res.json({ enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const setToolEnabled = (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'Enabled must be a boolean' });
        return;
    }
    toolManagerService.setToolEnabled(toolId, enabled);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getAll = (req: Request, res: Response) => {
    try {
        const config = toolManagerService.getAll();
        res.json(config);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export const getDefinitions = (req: Request, res: Response) => {
    try {
        const defs = toolRegistry.getDefinitions();
        res.json(defs);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export default {
  getToolEnabled,
  setToolEnabled,
  getAll,
  getDefinitions
};
