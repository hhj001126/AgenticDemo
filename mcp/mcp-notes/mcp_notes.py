"""简易笔记 MCP：内存存储，支持添加、列出、检索、删除"""

import json
from datetime import datetime
from typing import Optional

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

mcp = FastMCP("mcp-notes", stateless_http=True)

notes: dict[str, dict] = {}


@mcp.tool()
def add_note(title: str, content: str, tags: Optional[str] = None) -> str:
    """添加一条笔记。tags 为逗号分隔的标签。"""
    note_id = f"note_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(notes)}"
    notes[note_id] = {
        "id": note_id,
        "title": title,
        "content": content,
        "tags": [t.strip() for t in (tags or "").split(",") if t.strip()],
        "created": datetime.now().isoformat(),
    }
    return json.dumps({"id": note_id, "status": "added"})


@mcp.tool()
def list_notes() -> str:
    """列出所有笔记的标题与 ID。"""
    items = [{"id": k, "title": v["title"], "tags": v["tags"]} for k, v in notes.items()]
    return json.dumps({"notes": items, "count": len(items)})


@mcp.tool()
def get_note(note_id: str) -> str:
    """根据 ID 获取笔记详情。"""
    if note_id not in notes:
        return json.dumps({"error": f"笔记不存在: {note_id}"})
    return json.dumps(notes[note_id])


@mcp.tool()
def search_notes(keyword: str) -> str:
    """按关键词搜索笔记（标题或内容）。"""
    keyword_lower = keyword.lower()
    found = [
        v for v in notes.values()
        if keyword_lower in v["title"].lower() or keyword_lower in v["content"].lower()
    ]
    return json.dumps({"notes": found, "count": len(found)})


@mcp.tool()
def delete_note(note_id: str) -> str:
    """根据 ID 删除笔记。"""
    if note_id not in notes:
        return json.dumps({"error": f"笔记不存在: {note_id}"})
    del notes[note_id]
    return json.dumps({"id": note_id, "status": "deleted"})


def main():
    app = mcp.http_app(middleware=_cors_middleware)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5203)


if __name__ == "__main__":
    main()
