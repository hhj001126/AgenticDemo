import { Request, Response } from 'express';
import { vectorStoreService } from '../services/vector/store';

const getChunks = (req: Request, res: Response) => {
  try {
    const chunks = vectorStoreService.getChunks();
    res.json(chunks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const addChunks = (req: Request, res: Response) => {
  try {
    const { chunks } = req.body;
    vectorStoreService.addChunks(chunks);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const clear = (req: Request, res: Response) => {
  try {
    vectorStoreService.clear();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const search = (req: Request, res: Response) => {
  try {
    const { query, limit } = req.query;
    if (typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
    }
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : 10;
    const results = vectorStoreService.search(query, limitNum);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export default {
  getChunks,
  addChunks,
  clear,
  search
};
