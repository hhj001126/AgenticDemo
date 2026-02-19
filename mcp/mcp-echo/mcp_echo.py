"""回显测试 MCP：用于验证 MCP 连接是否正常"""

import json
from datetime import datetime

from fastmcp import FastMCP
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

# CORS 用于浏览器端 Inspector（如 inspector.use-mcp.dev）连接本地服务
_cors_middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["mcp-protocol-version", "mcp-session-id", "Authorization", "Content-Type"],
        expose_headers=["mcp-session-id"],
    )
]

mcp = FastMCP("mcp-echo", stateless_http=True)


@mcp.tool()
def echo(message: str) -> str:
    """回显输入的消息，附带时间戳。用于测试 MCP 连接。"""
    return json.dumps({
        "message": message,
        "echoed_at": datetime.now().isoformat(),
        "status": "ok",
    })


@mcp.tool()
def ping() -> str:
    """健康检查，返回 pong 与当前时间。"""
    return json.dumps({
        "response": "pong",
        "timestamp": datetime.now().isoformat(),
    })


def main():
    app = mcp.http_app(middleware=_cors_middleware)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5204)


if __name__ == "__main__":
    main()
