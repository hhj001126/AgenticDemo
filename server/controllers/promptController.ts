import { Request, Response } from 'express';
import { SUPERVISOR_SYSTEM, SEMANTIC_CHUNKER_PROMPT, ANALYZE_REQUIREMENTS_PROMPT } from '../services/prompts';
import { AgentMode } from '../../types';

const getPrompt = (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    let content = '';
    
    // Return default rendered prompts for inspection
    if (type === 'supervisor') {
        content = SUPERVISOR_SYSTEM({ 
            industry: 'General', 
            mode: AgentMode.AGENTIC 
        });
    } else if (type === 'chunker') {
        content = SEMANTIC_CHUNKER_PROMPT('{{text}}');
    } else if (type === 'analyze') {
        content = ANALYZE_REQUIREMENTS_PROMPT('{{context}}', 'General', AgentMode.AGENTIC);
    } else {
        return res.status(404).json({ error: 'Prompt type not found' });
    }
    
    res.json({ type, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export default {
  getPrompt
};
