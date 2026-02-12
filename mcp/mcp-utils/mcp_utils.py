"""实用工具 MCP：计算、日期、随机数、UUID、文本处理"""

import json
import random
import re
import uuid
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

mcp = FastMCP("mcp-utils")


@mcp.tool()
def calculate(expression: str) -> str:
    """安全计算数学表达式。支持 + - * / ** 及括号，仅允许数字与运算符。示例：calculate(\"2 + 3 * 4\")"""
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return json.dumps({"error": "表达式包含非法字符"})
    safe_expr = expression
    try:
        result = eval(safe_expr)
        return json.dumps({"expression": expression, "result": result})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_current_datetime(format_str: str = "iso") -> str:
    """获取当前系统日期时间。format_str: 'iso' 或 'locale' 或 strftime 格式如 '%Y-%m-%d %H:%M'"""
    now = datetime.now()
    if format_str == "iso":
        return json.dumps({"datetime": now.isoformat()})
    if format_str == "locale":
        return json.dumps({"datetime": now.strftime("%Y-%m-%d %H:%M:%S")})
    try:
        return json.dumps({"datetime": now.strftime(format_str)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def random_number(min_val: int = 0, max_val: int = 100) -> str:
    """生成指定范围内的随机整数。"""
    return json.dumps({"min": min_val, "max": max_val, "value": random.randint(min_val, max_val)})


@mcp.tool()
def generate_uuid() -> str:
    """生成一个 UUID v4。"""
    return json.dumps({"uuid": str(uuid.uuid4())})


@mcp.tool()
def text_word_count(text: str) -> str:
    """统计文本的字数、词数（按空格分词）、行数。"""
    words = len(text.split())
    lines = len(text.strip().split("\n")) if text.strip() else 0
    return json.dumps({"chars": len(text), "words": words, "lines": lines})


def main():
    app = mcp.http_app(middleware=_cors_middleware)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5201)


if __name__ == "__main__":
    main()
