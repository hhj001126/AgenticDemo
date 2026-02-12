"""时间相关 MCP：时区、日期差、格式化"""

import json
from datetime import datetime
from zoneinfo import ZoneInfo

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

mcp = FastMCP("mcp-time")


@mcp.tool()
def get_time_in_timezone(timezone: str = "Asia/Shanghai") -> str:
    """获取指定时区的当前时间。timezone 示例：Asia/Shanghai, UTC, America/New_York"""
    try:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        return json.dumps({
            "timezone": timezone,
            "datetime": now.isoformat(),
            "formatted": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def date_diff(date1: str, date2: str) -> str:
    """计算两个日期之间的天数差。格式：YYYY-MM-DD。date1 - date2。"""
    try:
        d1 = datetime.strptime(date1.strip(), "%Y-%m-%d").date()
        d2 = datetime.strptime(date2.strip(), "%Y-%m-%d").date()
        delta = (d1 - d2).days
        return json.dumps({"date1": date1, "date2": date2, "days_diff": delta})
    except ValueError as e:
        return json.dumps({"error": f"日期格式错误，需 YYYY-MM-DD: {e}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def format_timestamp(timestamp: float, timezone: str = "UTC") -> str:
    """将 Unix 时间戳格式化为可读日期时间。"""
    try:
        dt = datetime.fromtimestamp(timestamp, tz=ZoneInfo(timezone))
        return json.dumps({
            "timestamp": timestamp,
            "datetime": dt.isoformat(),
            "formatted": dt.strftime("%Y-%m-%d %H:%M:%S %Z"),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


def main():
    app = mcp.http_app(middleware=_cors_middleware)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5205)


if __name__ == "__main__":
    main()
