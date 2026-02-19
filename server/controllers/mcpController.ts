import { Request, Response } from 'express';
import { mcpManager, McpServerConfig } from '../services/mcp/manager';

export const listMcpServers = (req: Request, res: Response) => {
  res.json(mcpManager.getServers());
};

export const addMcpServer = async (req: Request, res: Response) => {
  try {
    const config: McpServerConfig = req.body;
    const server = await mcpManager.addServer(config);
    res.json(server);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeMcpServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await mcpManager.removeServer(id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMcpServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await mcpManager.updateServer(id as string, updates);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const connectMcpServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await mcpManager.connectById(id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const disconnectMcpServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await mcpManager.disconnectById(id as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const testMcpServer = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }
    const result = await mcpManager.testConnection(url);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

