"""
有度即时通 MCP 服务（YouduIM）。

提供有度即时通的应用消息、素材管理、部门、用户、群组、会话等功能。
官方文档：https://youdu.cn/doc#41-143
"""
import os
import json
from pathlib import Path
from fastmcp import FastMCP
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from .client import YouduClient

load_dotenv()

mcp = FastMCP("YouduIM", stateless_http=True)

def get_client() -> YouduClient:
    return YouduClient(
        api_url=os.getenv("YOUDU_API_URL", "").strip(),
        bu_id=int(os.getenv("YOUDU_BU_ID", "0").strip() or "0"),
        app_id=os.getenv("YOUDU_APP_ID", "").strip(),
        app_key=os.getenv("YOUDU_APP_KEY", "").strip(),
    )


# ---------- 应用消息（AppClient） ----------

@mcp.tool()
async def youdu_send_app_text(
    to_user: str,
    content: str,
    to_dept: str = "",
) -> Dict:
    """发送应用文本消息。to_user 多个用 | 分隔；to_dept 多个部门用 | 分隔，可为空。"""
    client = get_client()
    body = {
        "toUser": to_user,
        "toDept": to_dept or "",
        "msgType": "text",
        "text": {"content": content},
    }
    return await client.request("POST", "/cgi/msg/send", body=body)


@mcp.tool()
async def youdu_send_app_image(to_user: str, media_id: str, to_dept: str = "") -> Dict:
    """发送应用图片消息（需先通过 youdu_upload_media 上传得到 media_id）。"""
    client = get_client()
    body = {
        "toUser": to_user,
        "toDept": to_dept or "",
        "msgType": "image",
        "image": {"media_id": media_id},
    }
    return await client.request("POST", "/cgi/msg/send", body=body)


@mcp.tool()
async def youdu_send_app_file(to_user: str, media_id: str, to_dept: str = "") -> Dict:
    """发送应用文件消息（需先通过 youdu_upload_media 上传得到 media_id）。"""
    client = get_client()
    body = {
        "toUser": to_user,
        "toDept": to_dept or "",
        "msgType": "file",
        "file": {"media_id": media_id},
    }
    return await client.request("POST", "/cgi/msg/send", body=body)


@mcp.tool()
async def youdu_send_app_link(
    to_user: str,
    url: str,
    title: str,
    to_dept: str = "",
    action: int = 0,
) -> Dict:
    """发送应用隐式链接消息。action=1 时客户端会在 url 后追加有度身份 token。"""
    client = get_client()
    body = {
        "toUser": to_user,
        "toDept": to_dept or "",
        "msgType": "link",
        "link": {"url": url, "title": title, "action": action},
    }
    return await client.request("POST", "/cgi/msg/send", body=body)


@mcp.tool()
async def youdu_set_app_notice(account: str, count: int, tips: str = "", extra_json: str = "") -> Dict:
    """设置应用角标（待办数）。account 为目标用户账号，count 为角标数字，tips 为弹窗提醒（可为空）。extra_json 为可选 JSON 字符串，合并为请求体其余参数。"""
    client = get_client()
    body = {"account": account, "count": count, "tips": tips or ""}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/set.ent.notice", body=body)


# ---------- 素材管理 ----------

@mcp.tool()
async def youdu_upload_media(
    media_type: str,
    name: str,
    file_path: str,
) -> Dict:
    """上传图片或文件到素材库。media_type 为 image 或 file，file_path 为本地文件绝对路径。返回 mediaId。"""
    path = Path(file_path)
    if not path.is_file():
        return {"errcode": -1, "errmsg": f"文件不存在: {file_path}"}
    data = path.read_bytes()
    client = get_client()
    media_id = await client.upload_media(
        "image" if media_type.strip().lower() == "image" else "file",
        name or path.name,
        data,
    )
    return {"errcode": 0, "mediaId": media_id} if media_id else {"errcode": -1, "errmsg": "上传失败"}


@mcp.tool()
async def youdu_download_media(media_id: str, save_dir: str) -> Dict:
    """根据 media_id 下载素材并保存到指定目录。返回保存后的本地路径或错误信息。"""
    client = get_client()
    try:
        data = await client.download_media(media_id)
    except Exception as e:
        return {"errcode": -1, "errmsg": str(e)}
    dir_path = Path(save_dir)
    dir_path.mkdir(parents=True, exist_ok=True)
    # 无扩展名时用 media_id 前 8 位
    name = f"youdu_{media_id[:8]}"
    out_path = dir_path / name
    out_path.write_bytes(data)
    return {"errcode": 0, "path": str(out_path.resolve())}


# ---------- 部门（OrgClient） ----------

@mcp.tool()
async def youdu_dept_list_children(dept_id: int = 0) -> Dict:
    """获取部门直属子部门列表。dept_id=0 表示根部门。"""
    client = get_client()
    return await client.request("GET", "/cgi/dept/listchildren", params={"id": dept_id})


@mcp.tool()
async def youdu_dept_get(dept_id: int) -> Dict:
    """获取单个部门详情。"""
    client = get_client()
    return await client.request("GET", "/cgi/dept/get", params={"id": dept_id})


@mcp.tool()
async def youdu_dept_create(
    name: str,
    parent_id: int = 0,
    sort_id: int = 0,
    alias: str = "",
) -> Dict:
    """创建部门。parent_id 为父部门 ID，根为 0。"""
    client = get_client()
    body = {
        "name": name,
        "parentId": parent_id,
        "sortId": sort_id,
        "alias": alias or "",
    }
    return await client.request("POST", "/cgi/dept/create", body=body)


@mcp.tool()
async def youdu_dept_update(
    dept_id: int,
    name: str,
    parent_id: Optional[int] = None,
    sort_id: Optional[int] = None,
    alias: str = "",
) -> Dict:
    """更新部门信息。"""
    client = get_client()
    body = {"id": dept_id, "name": name, "alias": alias or ""}
    if parent_id is not None:
        body["parentId"] = parent_id
    if sort_id is not None:
        body["sortId"] = sort_id
    return await client.request("POST", "/cgi/dept/update", body=body)


@mcp.tool()
async def youdu_dept_delete(dept_id: int) -> Dict:
    """删除部门。"""
    client = get_client()
    return await client.request("GET", "/cgi/dept/delete", params={"id": dept_id})


# ---------- 用户 ----------

@mcp.tool()
async def youdu_user_get(user_id: str) -> Dict:
    """获取用户详细信息。"""
    client = get_client()
    return await client.request("GET", "/cgi/user/get", params={"userId": user_id})


@mcp.tool()
async def youdu_user_list_by_dept(dept_id: int) -> Dict:
    """获取部门下用户列表。"""
    client = get_client()
    return await client.request("GET", "/cgi/user/list", params={"deptId": dept_id})


# ---------- 群组 ----------

@mcp.tool()
async def youdu_group_list(user_id: str = "", extra_json: str = "") -> Dict:
    """获取群列表。user_id 非空时返回该用户所在群；为空时返回所有群。extra_json 可合并其他请求参数。"""
    client = get_client()
    params: Dict = {}
    if user_id and user_id.strip():
        params["userId"] = user_id.strip()
    if extra_json and extra_json.strip():
        try:
            params.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("GET", "/cgi/group/list", params=params if params else None)


@mcp.tool()
async def youdu_group_info(group_id: str, extra_json: str = "") -> Dict:
    """获取群详情。可选 extra_json 合并为请求参数。"""
    client = get_client()
    params = {"id": group_id}
    if extra_json and extra_json.strip():
        try:
            params.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("GET", "/cgi/group/info", params=params)


@mcp.tool()
async def youdu_group_create(name: str, extra_json: str = "") -> Dict:
    """创建群。extra_json 可传其他请求体参数。"""
    client = get_client()
    body = {"name": name}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/group/create", body=body)


@mcp.tool()
async def youdu_group_update(group_id: str, name: str = "", extra_json: str = "") -> Dict:
    """更新群名称等。name 为空时可由 extra_json 传入。"""
    client = get_client()
    body = {"id": group_id}
    if name:
        body["name"] = name
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/group/update", body=body)


@mcp.tool()
async def youdu_group_add_members(group_id: str, user_list: str, extra_json: str = "") -> Dict:
    """添加群成员。user_list 为多个账号用英文逗号分隔。"""
    client = get_client()
    users = [u.strip() for u in user_list.split(",") if u.strip()]
    body = {"id": group_id, "userList": users}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/group/addmember", body=body)


@mcp.tool()
async def youdu_group_remove_members(group_id: str, user_list: str, extra_json: str = "") -> Dict:
    """移除群成员。user_list 为多个账号用英文逗号分隔。"""
    client = get_client()
    users = [u.strip() for u in user_list.split(",") if u.strip()]
    body = {"id": group_id, "userList": users}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/group/delmember", body=body)


@mcp.tool()
async def youdu_group_delete(group_id: str) -> Dict:
    """删除群。"""
    client = get_client()
    return await client.request("GET", "/cgi/group/delete", params={"id": group_id})


# ---------- 会话与会话消息（SessionClient） ----------

@mcp.tool()
async def youdu_session_create(title: str, creator: str, members: str) -> Dict:
    """创建多人会话。members 为成员账号，多个用英文逗号分隔。"""
    client = get_client()
    member_list = [m.strip() for m in members.split(",") if m.strip()]
    body = {"title": title, "creator": creator, "member": member_list}
    return await client.request("POST", "/cgi/session/create", body=body)


@mcp.tool()
async def youdu_session_get(session_id: str) -> Dict:
    """获取会话详情。"""
    client = get_client()
    return await client.request("GET", "/cgi/session/get", params={"sessionId": session_id})


@mcp.tool()
async def youdu_send_single_text(sender: str, receiver: str, content: str, extra_json: str = "") -> Dict:
    """发送单人会话文本消息。sender 为发送者账号，receiver 为接收者账号，content 为消息内容。extra_json 可合并其他请求参数。"""
    client = get_client()
    body = {"sender": sender, "receiver": receiver, "msgType": "text", "text": {"content": content}}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/session/send", body=body)


@mcp.tool()
async def youdu_send_session_text(sender: str, session_id: str, content: str, extra_json: str = "") -> Dict:
    """发送多人会话（或群）文本消息。sender 为发送者账号，session_id 为会话 ID，content 为消息内容。extra_json 可合并其他请求参数。"""
    client = get_client()
    body = {"sender": sender, "sessionId": session_id, "msgType": "text", "text": {"content": content}}
    if extra_json and extra_json.strip():
        try:
            body.update(json.loads(extra_json))
        except json.JSONDecodeError:
            pass
    return await client.request("POST", "/cgi/session/send", body=body)


# ---------- 单点登录身份认证（IdentifyClient，通常无需 token） ----------

@mcp.tool()
async def youdu_identify(yd_token: str) -> Dict:
    """根据有度客户端提供的 ydToken 做身份认证，返回用户信息（账号、姓名、手机等）。无需应用 token。"""
    api_url = os.getenv("YOUDU_API_URL", "").rstrip("/")
    if not api_url:
        return {"errcode": -1, "errmsg": "未配置 YOUDU_API_URL"}
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{api_url}/cgi/identify",
            params={"ydToken": yd_token},
        )
    data = resp.json()
    return data


def main():
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    _cors = [Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["mcp-protocol-version", "mcp-session-id", "Authorization", "Content-Type"],
        expose_headers=["mcp-session-id"],
    )]
    app = mcp.http_app(middleware=_cors)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5206)


if __name__ == "__main__":
    main()
