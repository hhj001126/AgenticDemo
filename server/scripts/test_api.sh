#!/usr/bin/env bash
# API 接口测试脚本：Sessions、SSE Chat Stream、Chunks
# 使用前请确保 Go 服务已启动：cd server && go run ./cmd/server

set -e
BASE="${BASE_URL:-http://localhost:8080}"
API="${BASE}/api"
PASS=0
FAIL=0

green()  { echo -e "\033[0;32m✓ $*\033[0m"; PASS=$((PASS+1)); }
red()    { echo -e "\033[0;31m✗ $*\033[0m"; FAIL=$((FAIL+1)); }

# 检测服务是否可达
if ! curl -s -o /dev/null -w "%{http_code}" "$API/sessions" > /dev/null 2>&1; then
  echo "错误: 无法连接 $API，请先启动服务："
  echo "  cd server && go run ./cmd/server"
  exit 1
fi

echo "=========================================="
echo "  API 测试 (BASE=$API)"
echo "=========================================="

# --- 1. Session: 创建 ---
echo ""
echo "[1] POST /api/sessions (创建会话)"
R=$(curl -s -X POST "$API/sessions")
SID=$(echo "$R" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
if [[ -n "$SID" ]]; then
  green "创建会话成功 sessionId=$SID"
else
  red "创建会话失败: $R"
fi

# --- 2. Session: 列表 ---
echo ""
echo "[2] GET /api/sessions (列表)"
R=$(curl -s "$API/sessions")
if echo "$R" | grep -q "$SID\|sessionId"; then
  green "会话列表返回正常"
else
  red "会话列表异常: $R"
fi

# --- 3. Session: 获取活跃 ---
echo ""
echo "[3] GET /api/sessions/active (当前活跃)"
R=$(curl -s "$API/sessions/active")
if echo "$R" | grep -q "sessionId"; then
  green "活跃会话返回正常"
else
  red "活跃会话异常: $R"
fi

# --- 4. Session: 获取详情 ---
echo ""
echo "[4] GET /api/sessions/:id (会话详情)"
R=$(curl -s "$API/sessions/$SID")
if echo "$R" | grep -q "sessionId\|geminiHistory\|uiMessages\|vfs"; then
  green "会话详情返回正常"
else
  red "会话详情异常: $R"
fi

# --- 5. Session: 切换活跃 ---
echo ""
echo "[5] PUT /api/sessions/:id/active (切换活跃)"
R=$(curl -s -X PUT "$API/sessions/$SID/active")
if echo "$R" | grep -q "sessionId"; then
  green "切换活跃成功"
else
  red "切换活跃异常: $R"
fi

# --- 6. Session: 更新标题 ---
echo ""
echo "[6] PUT /api/sessions/:id/title (更新标题)"
R=$(curl -s -X PUT "$API/sessions/$SID/title" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试会话标题"}')
if echo "$R" | grep -q "success"; then
  green "更新标题成功"
else
  red "更新标题异常: $R"
fi

# --- 7. Session: 追加 Chunks ---
echo ""
echo "[7] POST /api/sessions/:id/chunks (追加知识分块)"
R=$(curl -s -X POST "$API/sessions/$SID/chunks" \
  -H "Content-Type: application/json" \
  -d '{"chunks":[{"content":"测试内容","summary":"摘要","boundaryReason":"语义边界"}]}')
if echo "$R" | grep -q "success"; then
  green "追加 chunks 成功"
else
  red "追加 chunks 异常: $R"
fi

# --- 8. SSE: Chat Stream ---
echo ""
echo "[8] POST /api/chat/stream (SSE 流式对话)"
EVENTS=""
STATUS=0
TIMEOUT=30
if [[ -z "$GEMINI_API_KEY" ]] && [[ -z "$GOOGLE_API_KEY" ]]; then
  echo "  跳过: 未设置 GEMINI_API_KEY/GOOGLE_API_KEY"
else
  R=$(curl -s -N -X POST "$API/chat/stream" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$SID\",\"message\":\"你好，请简短回复\"}" \
    --max-time $TIMEOUT 2>/dev/null) || STATUS=$?
  if [[ $STATUS -eq 0 ]]; then
    if echo "$R" | grep -q "event:"; then
      EVENTS=$(echo "$R" | grep "^event:" | sed 's/event: *//' | tr '\n' ' ')
      if echo "$EVENTS" | grep -q "text\|done\|error"; then
        green "SSE 流式返回正常 events=[$EVENTS]"
      else
        red "SSE 未收到预期 event: $EVENTS"
      fi
    else
      red "SSE 响应格式异常 (无 event 行)"
    fi
  else
    red "SSE 请求超时或失败 (exit=$STATUS)"
  fi
fi

# --- 9. Session: Clear ---
echo ""
echo "[9] PUT /api/sessions/:id/clear (清空会话)"
R=$(curl -s -X PUT "$API/sessions/$SID/clear")
if echo "$R" | grep -q "success"; then
  green "清空会话成功"
else
  red "清空会话异常: $R"
fi

# --- 10. Session: 删除 ---
echo ""
echo "[10] DELETE /api/sessions/:id (删除会话)"
R=$(curl -s -X DELETE "$API/sessions/$SID")
if echo "$R" | grep -q "success"; then
  green "删除会话成功"
else
  red "删除会话异常: $R"
fi

# --- 11. 错误处理: 缺少 sessionId ---
echo ""
echo "[11] 错误处理: chat/stream 缺少 sessionId"
R=$(curl -s -X POST "$API/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}')
if echo "$R" | grep -q "error\|required"; then
  green "正确返回错误"
else
  red "应返回错误: $R"
fi

echo ""
echo "=========================================="
echo "  结果: 通过 $PASS, 失败 $FAIL"
echo "=========================================="
[[ $FAIL -eq 0 ]]
