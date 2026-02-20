# Go 后端

基于 [服务端 Go 迁移计划](../.cursor/plans/服务端_go_迁移计划.md) 实现的 AgenticDemo 后端服务。

## 启动

```bash
# 在项目根目录
export GEMINI_API_KEY=your_key
npm run server

# 或
cd server && go run ./cmd/server
```

默认监听 `http://localhost:8080`。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| GEMINI_API_KEY | Gemini API 密钥 | - |
| PORT | 服务端口 | 8080 |
| DATA_DIR | 数据目录（会话等） | .agent |

## 前端联调

1. 启动 Go 后端：`npm run server`
2. 设置 `VITE_USE_GO_BACKEND=true` 并启动前端：`VITE_USE_GO_BACKEND=true npm run dev`
3. Vite 会将 `/api` 代理到 `http://localhost:8080`

## API

- `POST /api/sessions` - 创建会话
- `GET /api/sessions` - 列表会话
- `GET /api/sessions/active` - 当前活跃会话
- `GET /api/sessions/:id` - 获取会话
- `PUT /api/sessions/:id/active` - 切换活跃
- `DELETE /api/sessions/:id` - 删除会话
- `PUT /api/sessions/:id/title` - 更新标题
- `PUT /api/sessions/:id/clear` - 清空内容
- `POST /api/chat/stream` - 流式对话（text/event-stream）
