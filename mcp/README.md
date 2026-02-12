# MCP 工具目录

本目录按**工具名称**分子目录存放各类 MCP 服务，便于扩展和维护。

## 一、项目内用 MCP（供 AgenticDemo 工具管理页连接）

以下 MCP 以 **HTTP/SSE** 运行，可在工具管理页「添加 MCP」中连接使用：

| 目录 | 端口 | URL | 说明 |
|------|------|-----|------|
| [mcp-utils](./mcp-utils/) | 5201 | http://localhost:5201/mcp | 计算、日期、随机数、UUID、文本统计 |
| [mcp-file-ops](./mcp-file-ops/) | 5202 | http://localhost:5202/mcp | 文件读写、列出目录；默认根目录为当前工作目录/file_ops，可通过环境变量 `MCP_FILE_OPS_ROOT` 指定（如 `E:\tmp`） |
| [mcp-notes](./mcp-notes/) | 5203 | http://localhost:5203/mcp | 简易笔记（内存存储） |
| [mcp-echo](./mcp-echo/) | 5204 | http://localhost:5204/mcp | 回显测试，验证连接 |
| [mcp-time](./mcp-time/) | 5205 | http://localhost:5205/mcp | 时区、日期差、时间戳 |

### 启动方式

在项目根目录执行（需先安装 [uv](https://docs.astral.sh/uv/)）：

```bash
# 启动单个 MCP
npm run mcp:utils     # 端口 5201
npm run mcp:file-ops  # 端口 5202
npm run mcp:notes     # 端口 5203
npm run mcp:echo      # 端口 5204
npm run mcp:time      # 端口 5205

# 或手动启动
cd mcp/mcp-utils && uv sync && uv run python mcp_utils.py
```

**mcp-file-ops 指定操作目录**（如写入到 `E:\tmp`）：

```bash
# Windows
set MCP_FILE_OPS_ROOT=E:\tmp
npm run mcp:file-ops

# 或在项目根目录下使用默认根目录：<cwd>/file_ops
npm run mcp:file-ops
```

启动后在工具管理页添加对应 URL（如 `http://localhost:5201/mcp`）并连接即可。

---

## 二、Cursor 用 MCP（stdio 模式）

| 目录 | 说明 |
|------|------|
| [mcp-feedback-enhanced](./mcp-feedback-enhanced/) | 交互式用户反馈与命令执行，支持 Web UI / 桌面端 |

配置位于 `.cursor/mcp.json`，由 Cursor 自动启动。

---

## 目录约定

- 每个 MCP 工具单独一个子目录，目录名与工具名一致。
- 项目内用 MCP：HTTP 传输，供工具管理页连接。
- Cursor 用 MCP：stdio 传输，在 `.cursor/mcp.json` 中配置。
