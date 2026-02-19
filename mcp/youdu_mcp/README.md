# 有度即时通 MCP（YouduIM）

对有度即时通服务端 API 的 MCP 封装。**接口路径与请求参数以 [youdu-sdk-java](https://github.com/youduim/youdu-sdk-java) 中的 YdApi、SessionClient 等为准**，与[有度开发者文档](https://youdu.cn/doc#41-143)一致；部分工具提供 `extra_json` 以透传官方文档中的其他请求参数。

## 环境配置

复制 `.env.example` 为 `.env`，填写有度服务器与应用信息：

- `YOUDU_API_URL`：有度服务器地址，如 `http://127.0.0.1:7080`
- `YOUDU_BU_ID`：企业总机号
- `YOUDU_APP_ID`：应用 ID（管理后台创建应用后获取）
- `YOUDU_APP_KEY`：应用 EncodingAESKey（Base64）

## 启动

在项目根目录：

```bash
npm run mcp:youdu
```

或进入本目录后：

```bash
cd mcp/youdu_mcp && uv sync && uv run python -m run.py
```

默认 HTTP 端口：**5206**。本服务使用 **SSE 传输**，连接时请使用 **`http://localhost:5206/sse`**（与项目 MCP 后端的 GET + event-stream 方式一致）。

## 全量功能测试

在 `mcp/youdu_mcp` 下执行（需先配置 `.env`）：

```bash
uv run python test_all.py              # 实际请求（只读 + 发送，不含删除）
uv run python test_all.py --dry        # 仅打印将要调用的接口
uv run python test_all.py --destructive   # 含创建部门/群/会话、删除等
```

可选环境变量：`TEST_TO_USER`、`TEST_FROM_USER`、`TEST_DEPT_ID`、`TEST_USER_ID`、`TEST_GROUP_ID`、`TEST_SESSION_ID`、`TEST_MEDIA_FILE`、`TEST_SAVE_DIR`、`TEST_YD_TOKEN`（详见 `test_all.py` 顶部注释）。

## 工具一览

| 分类 | 工具名 | 说明 |
|------|--------|------|
| **应用消息** | `youdu_send_app_text` | 发送应用文本消息（支持 to_user / to_dept，多值用 \| 分隔） |
| | `youdu_send_app_image` | 发送应用图片（需先上传得 media_id） |
| | `youdu_send_app_file` | 发送应用文件（需先上传得 media_id） |
| | `youdu_send_app_link` | 发送应用隐式链接 |
| | `youdu_set_app_notice` | 设置应用角标（待办数） |
| **素材** | `youdu_upload_media` | 上传图片/文件，返回 mediaId |
| | `youdu_download_media` | 按 media_id 下载素材到本地目录 |
| **部门** | `youdu_dept_list_children` | 获取子部门列表 |
| | `youdu_dept_get` | 获取部门详情 |
| | `youdu_dept_create` / `youdu_dept_update` / `youdu_dept_delete` | 部门增删改 |
| **用户** | `youdu_user_get` | 获取用户详情 |
| | `youdu_user_list_by_dept` | 按部门获取用户列表 |
| **群组** | `youdu_group_list` | 群列表（可选 user_id 查某用户所在群；extra_json） |
| | `youdu_group_info` / `youdu_group_create` / `youdu_group_update` / `youdu_group_delete` | 群信息与增删改（参数与 YdApi/GroupClient 一致：id、name、userList 等） |
| | `youdu_group_add_members` / `youdu_group_remove_members` | 群成员增删（请求体 id、userList） |
| **会话** | `youdu_session_create` / `youdu_session_get` | 创建/查询多人会话 |
| | `youdu_send_single_text` | 发送单人会话文本（/cgi/session/send，sender/receiver/msgType/text） |
| | `youdu_send_session_text` | 发送多人/群会话文本（/cgi/session/send，sender/sessionId/msgType/text） |
| **认证** | `youdu_identify` | 凭 ydToken 身份认证（无需应用 token） |

会话消息、角标、群组等工具支持 `extra_json` 传入 JSON 字符串，会合并到请求体/参数，以支持官方文档中的其他参数。
