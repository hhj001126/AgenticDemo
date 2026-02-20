package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/setup"
	"agentic-demo/server/internal/store"
)

func TestChatStream_Validation(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.NewSessionStore(filepath.Join(dir, "sessions"))
	todoStore := store.NewTodoStore(filepath.Join(dir, "data"))
	reg := registry.New()
	setup.RegisterBuiltinTools(reg)
	h := NewHandler(s, todoStore, reg)
	if h == nil {
		t.Fatal("handler is nil")
	}

	tests := []struct {
		name     string
		body     string
		wantCode int
	}{
		{
			name:     "缺少sessionId",
			body:     `{"message":"hi"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "空body",
			body:     `{}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "无效JSON",
			body:     `{invalid`,
			wantCode: http.StatusBadRequest,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/chat/stream", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			h.ChatStream(rec, req)
			if rec.Code != tt.wantCode {
				t.Errorf("ChatStream() code = %d, want %d", rec.Code, tt.wantCode)
			}
		})
	}
}
