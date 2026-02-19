import { Request, Response } from 'express';
import { sessionService } from '../services/agent/state';

const createSession = async (req: Request, res: Response) => {
  try {
    const sessionId = await sessionService.createSession();
    res.json({ sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const listSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await sessionService.listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const getSession = async (req: Request, res: Response) => {
  try {
    const session = await sessionService.getSession(req.params.sessionId as string);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const getActiveSession = async (req: Request, res: Response) => {
    try {
        const sessionId = await sessionService.getActiveSessionId();
        res.json({ sessionId });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

const switchSession = async (req: Request, res: Response) => {
  try {
    await sessionService.setActiveSession(req.params.sessionId as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const deleteSession = async (req: Request, res: Response) => {
  try {
    await sessionService.deleteSession(req.params.sessionId as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const updateTitle = async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    await sessionService.updateSession(req.params.sessionId as string, { title });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const updateVfs = async (req: Request, res: Response) => {
    try {
        const { vfs } = req.body;
        await sessionService.updateSession(req.params.sessionId as string, { vfs });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

const clearContent = async (req: Request, res: Response) => {
    try {
        await sessionService.clearSessionContent(req.params.sessionId as string);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export default {
  createSession,
  listSessions,
  getSession,
  getActiveSession,
  switchSession,
  deleteSession,
  updateTitle,
  updateVfs,
  clearContent
};
