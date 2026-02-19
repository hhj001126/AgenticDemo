import { Request, Response } from 'express';
import { chunkerService } from '../services/chunk/chunker';

const chunkText = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    const chunks = await chunkerService.chunkText(text);
    res.json(chunks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export default {
  chunkText
};
