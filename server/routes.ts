import { Router } from 'express';
import sessionController from './controllers/sessionController';
import vectorController from './controllers/vectorController';
import chunkController from './controllers/chunkController';
import toolController from './controllers/toolController';
import promptController from './controllers/promptController';
import chatController from './controllers/chatController';
import { listMcpServers, addMcpServer, removeMcpServer, updateMcpServer, connectMcpServer, disconnectMcpServer, testMcpServer } from './controllers/mcpController';

const router = Router();

// Session Routes
router.post('/sessions', sessionController.createSession);
router.get('/sessions', sessionController.listSessions);
router.get('/sessions/active', sessionController.getActiveSession);
router.get('/sessions/:sessionId', sessionController.getSession);
router.put('/sessions/:sessionId/active', sessionController.switchSession);
router.delete('/sessions/:sessionId', sessionController.deleteSession);
router.put('/sessions/:sessionId/title', sessionController.updateTitle);
router.put('/sessions/:sessionId/vfs', sessionController.updateVfs);

// Vector Routes
router.get('/vector/chunks', vectorController.getChunks);
router.post('/vector/chunks', vectorController.addChunks);
router.delete('/vector/chunks', vectorController.clear);
router.get('/vector/search', vectorController.search);

// Chunk Routes
router.post('/chunk', chunkController.chunkText);

// Tool Routes
router.get('/tools', toolController.getAll);
router.get('/tools/definitions', toolController.getDefinitions);
router.get('/tools/:toolId', toolController.getToolEnabled);
router.put('/tools/:toolId', toolController.setToolEnabled);

// Prompt Routes
router.get('/prompts/:type', promptController.getPrompt);

// Chat Routes
router.post('/chat/stream', chatController.chatStream);

// MCP Routes
router.get('/mcp/servers', listMcpServers);
router.post('/mcp/servers', addMcpServer);
router.delete('/mcp/servers/:id', removeMcpServer);
router.patch('/mcp/servers/:id', updateMcpServer);
router.post('/mcp/servers/:id/connect', connectMcpServer);
router.post('/mcp/servers/:id/disconnect', disconnectMcpServer);
router.post('/mcp/test', testMcpServer);

export default router;
