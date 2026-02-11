import React, { useState, useCallback } from 'react';
import { Folder, FileCode, Coffee, FileJson, Terminal, ShieldCheck, Network } from 'lucide-react';
import { FileTree } from './explorer/FileTree';
import { CodeViewer } from './explorer/CodeViewer';

const FILES: Record<string, string> = {
  'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.enterprise.ai</groupId>
    <artifactId>agent-orchestrator</artifactId>
    <version>1.2.0-RELEASE</version>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.4</version>
    </parent>

    <dependencies>
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-google-vertex-ai-gemini-spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-tracing-bundle-brave</artifactId>
        </dependency>
    </dependencies>
</project>`,
  'SupervisorService.java': `package com.enterprise.ai.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import lombok.extern.slf4j.Slf4j;

/**
 * Enterprise Agentic Supervisor (Java 17)
 * Implements Plan-Execute-Audit lifecycle for complex workflows.
 */
@Service
@Slf4j
public class SupervisorService {
    private final ChatClient chatClient;

    public SupervisorService(ChatClient.Builder builder) {
        this.chatClient = builder
            .defaultSystem("你是一个受监管的政企 Agent 编排器。请使用 tools 解决用户问题并输出合规性审计日志。")
            .build();
    }

    public Flux<String> processRequest(String sessionId, String prompt) {
        log.info("Session: {} | Received prompt: {}", sessionId, prompt);
        
        return chatClient.prompt()
            .user(prompt)
            .advisors(new ContextCompressionAdvisor())
            .functions("salesQuery", "roiCalculator", "mcpGateway")
            .stream()
            .content();
    }
}`,
  'McpGatewayTool.java': `package com.enterprise.ai.tool;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.model.function.FunctionCallback;
import org.springframework.ai.model.function.FunctionCallbackWrapper;

@Configuration
public class McpToolConfig {

    @Bean
    public FunctionCallback mcpGateway() {
        return FunctionCallbackWrapper.builder(new McpExecutor())
            .withName("mcp_gateway")
            .withDescription("统一模型上下文协议网关，连接 ERP、CRM、HR 等核心系统")
            .build();
    }

    static class McpExecutor implements java.util.function.Function<McpRequest, McpResponse> {
        @Override
        public McpResponse apply(McpRequest request) {
            // 实现 gRPC 调用外部 MCP Server
            return new McpResponse("SUCCESS", "Data from legacy system integrated.");
        }
    }
    
    public record McpRequest(String systemId, String query) {}
    public record McpResponse(String status, String payload) {}
}`,
  'SecurityConfig.java': `package com.enterprise.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@EnableWebFluxSecurity
public class SecurityConfig {
    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/api/v1/agent/**").hasRole("AGENT_OPERATOR")
                .anyExchange().authenticated()
            )
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .build();
    }
}`,
};

const getFileIcon = (name: string) => {
  if (name.endsWith('.java')) return <Coffee size={14} className="text-amber-500" />;
  if (name.endsWith('.xml')) return <FileJson size={14} className="text-indigo-400" />;
  return <Folder size={14} className="text-slate-500" />;
};

const ProjectExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('SupervisorService.java');
  const fileNames = Object.keys(FILES);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(FILES[selectedFile]);
  }, [selectedFile]);

  return (
    <div className="flex h-full bg-slate-900 text-slate-300 rounded-[2rem] border border-slate-700 overflow-hidden shadow-2xl">
      <div className="w-72 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-6 text-indigo-400">
          <Terminal size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Java Implementation</span>
        </div>

        <FileTree files={fileNames} selectedFile={selectedFile} onSelect={setSelectedFile} getIcon={getFileIcon} />

        <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">FIPS-140-2 Compliant</span>
          </div>
          <div className="flex items-center gap-3">
            <Network size={16} className="text-indigo-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">Micrometer Tracing</span>
          </div>
        </div>
      </div>

      <CodeViewer fileName={selectedFile} content={FILES[selectedFile]} onCopy={handleCopy} />
    </div>
  );
};

export default ProjectExplorer;
