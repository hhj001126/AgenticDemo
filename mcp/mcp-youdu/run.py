"""从 mcp/mcp-youdu 目录启动时，将 mcp 加入 path 以便 python -m mcp-youdu.server 能解析包。"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from mcp-youdu.server import main

if __name__ == "__main__":
    main()
