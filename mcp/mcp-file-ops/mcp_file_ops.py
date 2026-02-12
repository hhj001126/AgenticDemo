"""文件操作 MCP：读、写、列出目录（可配置操作根目录，直接接管系统文件操作）"""

import json
import os
from pathlib import Path

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

mcp = FastMCP("mcp-file-ops")

# 操作根目录：未设置 MCP_FILE_OPS_ROOT 时使用「当前工作目录/file_ops」；设置则使用指定目录（如 E:\tmp）
_env_root = os.environ.get("MCP_FILE_OPS_ROOT", "").strip()
ALLOWED_ROOT = Path(_env_root).resolve() if _env_root else (Path.cwd() / "file_ops")


def _resolve_path(rel_path: str) -> Path | None:
    """将相对路径解析为绝对路径，且必须在 ALLOWED_ROOT 之下。"""
    p = (ALLOWED_ROOT / rel_path.lstrip("/")).resolve()
    try:
        p.relative_to(ALLOWED_ROOT)
    except ValueError:
        return None
    return p


@mcp.tool()
def read_file(path: str) -> str:
    """读取文本文件内容。path 为相对于操作根目录的路径（默认当前工作目录/file_ops，可通过环境变量 MCP_FILE_OPS_ROOT 指定，如 E:\\tmp）。"""
    p = _resolve_path(path)
    if not p or not p.exists():
        return json.dumps({"error": f"文件不存在或路径超出允许范围: {path}"})
    if not p.is_file():
        return json.dumps({"error": f"不是文件: {path}"})
    try:
        content = p.read_text(encoding="utf-8", errors="replace")
        return json.dumps({"path": str(p), "content": content})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def write_file(path: str, content: str) -> str:
    """写入文本文件。path 为相对于操作根目录的路径，不存在则创建。根目录默认当前工作目录/file_ops，可通过 MCP_FILE_OPS_ROOT 指定（如 E:\\tmp）。"""
    p = _resolve_path(path)
    if not p:
        return json.dumps({"error": f"路径超出允许范围: {path}"})
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return json.dumps({"path": str(p), "status": "written"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def list_directory(path: str = ".") -> str:
    """列出目录内容。path 为相对于操作根目录的路径，默认根目录本身。根目录可通过 MCP_FILE_OPS_ROOT 指定。"""
    p = _resolve_path(path)
    if not p or not p.exists():
        return json.dumps({"error": f"目录不存在或路径超出允许范围: {path}"})
    if not p.is_dir():
        return json.dumps({"error": f"不是目录: {path}"})
    try:
        entries = []
        for e in sorted(p.iterdir()):
            entries.append({"name": e.name, "type": "dir" if e.is_dir() else "file"})
        return json.dumps({"path": str(p), "entries": entries})
    except Exception as e:
        return json.dumps({"error": str(e)})


def main():
    app = mcp.http_app(middleware=_cors_middleware)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5202)


if __name__ == "__main__":
    main()
