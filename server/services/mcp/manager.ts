import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from '../../config';
import { toolRegistry } from '../agent/registry';
import { Type } from '@google/genai';

const MCP_CONFIG_FILE = path.join(DATA_DIR, 'mcp_servers.json');

export interface McpServerConfig {
  id: string;
  url: string; // MCP endpoint
  name?: string;
  enabled?: boolean;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: number | string;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: any;
  id?: number | string;
}

class McpManager {
  private servers: McpServerConfig[] = [];
  private activeConnections: Map<string, { endpoint?: string, controller?: AbortController }> = new Map();
  private connectingIds = new Set<string>();
  private serverErrors = new Map<string, string>();

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadConfig();
    this.connectEnabledServers();
  }

  private async loadConfig() {
    try {
      if (await fs.pathExists(MCP_CONFIG_FILE)) {
        this.servers = await fs.readJson(MCP_CONFIG_FILE);
      }
    } catch (error) {
      console.error('Failed to load MCP config:', error);
    }
  }

  private async saveConfig() {
    try {
      await fs.ensureDir(path.dirname(MCP_CONFIG_FILE));
      await fs.writeJson(MCP_CONFIG_FILE, this.servers, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save MCP config:', error);
    }
  }

  getServers() {
    return this.servers.map(s => ({
      ...s,
      status: this.getServerStatus(s.id),
      error: this.serverErrors.get(s.id)
    }));
  }

  getServerStatus(id: string): 'connected' | 'connecting' | 'failed' | 'disconnected' {
      if (this.connectingIds.has(id)) return 'connecting';
      if (this.activeConnections.has(id)) return 'connected';
      if (this.serverErrors.has(id)) return 'failed';
      return 'disconnected';
  }

  async addServer(config: McpServerConfig) {
    if (!config.id) config.id = Math.random().toString(36).substring(7);
    this.servers.push(config);
    await this.saveConfig();
    if (config.enabled !== false) {
      this.connectById(config.id);
    }
    return config;
  }

  async removeServer(id: string) {
    this.servers = this.servers.filter(s => s.id !== id);
    await this.saveConfig();
    this.disconnectById(id);
  }

  async updateServer(id: string, updates: Partial<McpServerConfig>) {
    const server = this.servers.find(s => s.id === id);
    if (server) {
      const urlChanged = updates.url && updates.url !== server.url;
      Object.assign(server, updates);
      await this.saveConfig();
      if (urlChanged) {
        this.disconnectById(id);
        if (server.enabled !== false) this.connectById(id);
      }
    }
  }

  private async connectEnabledServers() {
    for (const server of this.servers) {
      if (server.enabled !== false) {
        this.connectById(server.id);
      }
    }
  }

  async connectById(id: string) {
    const server = this.servers.find(s => s.id === id);
    if (!server) return;
    
    // Set enabled to true if manually connecting
    if (server.enabled === false) {
        server.enabled = true;
        await this.saveConfig();
    }

    if (this.connectingIds.has(id) || this.activeConnections.has(id)) return;

    this.connectingIds.add(id);
    this.serverErrors.delete(id);
    
    console.log(`Connecting to MCP server: ${server.name || server.id} at ${server.url}`);
    
    const controller = new AbortController();
    
    try {
      const response = await fetch(server.url, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.connectingIds.delete(id);
      this.activeConnections.set(id, { controller });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let endpointReceived = false;

      // Fallback for stateless servers: if no endpoint event received in 3s, use server URL
      const statelessTimeout = setTimeout(() => {
          if (!endpointReceived && this.activeConnections.has(id)) {
              console.log(`No endpoint event received for ${id}, assuming stateless at ${server.url}`);
              const current = this.activeConnections.get(id);
              if (current) {
                  this.activeConnections.set(id, { ...current, endpoint: server.url });
                  this.initializeServer(id); // Initialize immediately
              }
          }
      }, 3000);
      
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const eventLines = line.split('\n');
                let eventType = '';
                let data = '';
                for (const l of eventLines) {
                    if (l.startsWith('event: ')) eventType = l.slice(7).trim();
                    if (l.startsWith('data: ')) data = l.slice(6).trim();
                }
                
                if (eventType === 'endpoint') {
                    endpointReceived = true;
                    clearTimeout(statelessTimeout);
                    const baseUrl = new URL(server.url);
                    const postUrl = new URL(data, baseUrl).toString();
                    const current = this.activeConnections.get(id);
                    if (current) {
                        this.activeConnections.set(id, { ...current, endpoint: postUrl });
                        console.log(`MCP Server ${id} endpoint discovered: ${postUrl}`);
                        this.initializeServer(id);
                    }
                }
            }
          }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(`MCP connection error for ${id}:`, err);
                this.serverErrors.set(id, err.message || String(err));
            }
            this.disconnectById(id);
        } finally {
            clearTimeout(statelessTimeout);
            this.connectingIds.delete(id);
        }
      })();

    } catch (e: any) {
      this.connectingIds.delete(id);
      this.serverErrors.set(id, e.message || String(e));
      console.error(`Error connecting to MCP server ${id}:`, e);
    }
  }

  async disconnectById(id: string) {
    this.connectingIds.delete(id);
    const conn = this.activeConnections.get(id);
    if (conn) {
      if (conn.controller) conn.controller.abort();
      this.activeConnections.delete(id);
    }
    
    // Set enabled to false if manually disconnecting
    const server = this.servers.find(s => s.id === id);
    if (server) {
        server.enabled = false;
        await this.saveConfig();
    }

    // Unregister tools prefix with mcp_{id}__
    toolRegistry.unregisterBySource('mcp', (toolId) => toolId.startsWith(`mcp_${id}__`));
  }
  
  private async initializeServer(serverId: string) {
      try {
          await this.sendRequest(serverId, 'initialize', {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'antigravity-server', version: '1.0.0' }
          });
          
          await this.sendNotification(serverId, 'notifications/initialized');
          
          const response = await this.sendRequest(serverId, 'tools/list');
          const tools = (response as any).tools as McpTool[];
          
          if (tools) {
              this.registerTools(serverId, tools);
          }
      } catch (e: any) {
          console.error(`Failed to initialize/list tools for ${serverId}:`, e);
          this.serverErrors.set(serverId, `Initialization failed: ${e.message}`);
      }
  }

  private registerTools(serverId: string, tools: McpTool[]) {
      for (const tool of tools) {
          const toolId = `mcp_${serverId}__${tool.name}`;
          
          toolRegistry.register(toolId, {
              definition: {
                  name: toolId,
                  description: tool.description || `MCP Tool: ${tool.name}`,
                  parameters: this.mapSchema(tool.inputSchema)
              },
              executor: async (args: any, sessionId: string, onProgress?: (content: string) => void) => {
                  return this.sendRequest(serverId, 'tools/call', {
                      name: tool.name,
                      arguments: args
                  });
              }
          }, 'mcp');
      }
      console.log(`Registered ${tools.length} tools for MCP server ${serverId}`);
  }
  
  private mapSchema(schema: any) {
      const properties: any = {};
      const required: string[] = [];
      
      if (schema && schema.properties) {
          for (const key in schema.properties) {
              const prop = schema.properties[key];
              properties[key] = {
                  type: (prop.type || 'string').toUpperCase() as Type,
                  description: prop.description
              };
          }
          if (schema.required) {
              required.push(...schema.required);
          }
      }
      
      return {
          type: Type.OBJECT,
          properties,
          required
      };
  }

  private async sendRequest(serverId: string, method: string, params?: any): Promise<any> {
      const conn = this.activeConnections.get(serverId);
      if (!conn || !conn.endpoint) throw new Error(`Server ${serverId} not connected or endpoint unknown`);
      
      const id = Date.now();
      const payload: JsonRpcRequest = {
          jsonrpc: '2.0',
          method,
          params,
          id
      };
      
      const res = await fetch(conn.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(`MCP Request failed: ${res.statusText}`);
      
      const json: JsonRpcResponse = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
  }
  
  private async sendNotification(serverId: string, method: string, params?: any) {
      const conn = this.activeConnections.get(serverId);
      if (!conn || !conn.endpoint) return;
      
      const payload: JsonRpcRequest = {
          jsonrpc: '2.0',
          method,
          params
      };
      
      await fetch(conn.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
  }

  async testConnection(url: string): Promise<{ success: boolean; error?: string; toolCount?: number }> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      try {
          const response = await fetch(url, {
              headers: { Accept: 'text/event-stream' },
              signal: controller.signal
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let endpoint = '';

          // Wait for endpoint event
          const startTime = Date.now();
          while (Date.now() - startTime < 5000) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                  const eventLines = line.split('\n');
                  for (const l of eventLines) {
                      if (l.startsWith('data: ') && l.includes('endpoint')) {
                          // This is a bit simplified, but we just need to see if it responds with SSE
                      }
                      if (l.startsWith('event: endpoint')) {
                          const dataLine = eventLines.find(el => el.startsWith('data: '));
                          if (dataLine) {
                              endpoint = dataLine.slice(6).trim();
                              break;
                          }
                      }
                  }
                  if (endpoint) break;
              }
              if (endpoint) break;
          }

          if (!endpoint) throw new Error("Did not receive MCP endpoint event within 5s");

          // Clean up reader
          reader.cancel();
          clearTimeout(timeout);
          return { success: true };
      } catch (e: any) {
          clearTimeout(timeout);
          return { success: false, error: e.message || String(e) };
      }
  }
}

export const mcpManager = new McpManager();
