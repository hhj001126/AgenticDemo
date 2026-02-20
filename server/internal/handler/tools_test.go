package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/setup"
	"agentic-demo/server/internal/store"
)

func initTestHandlerWithTools(t *testing.T) *Handler {
	dir := t.TempDir()
	sessionsDir := filepath.Join(dir, "sessions")
	dataDir := filepath.Join(dir, "data")
	_ = os.MkdirAll(sessionsDir, 0755)
	s, err := store.NewSessionStore(sessionsDir)
	if err != nil {
		t.Fatalf("NewSessionStore: %v", err)
	}
	todoStore := store.NewTodoStore(dataDir)
	toolEnableStore, err := store.NewToolEnableStore(dataDir)
	if err != nil {
		t.Fatalf("NewToolEnableStore: %v", err)
	}
	mcpStore, err := store.NewMcpStore(dataDir)
	if err != nil {
		t.Fatalf("NewMcpStore: %v", err)
	}
	mcpStatusStore, err := store.NewMcpStatusStore(dataDir)
	if err != nil {
		t.Fatalf("NewMcpStatusStore: %v", err)
	}
	reg := registry.New()
	setup.RegisterBuiltinTools(reg)
	return NewHandlerWithTools(s, todoStore, reg, toolEnableStore, mcpStore, mcpStatusStore)
}

func TestListTools(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tools", nil)
	rec := httptest.NewRecorder()
	h.ListTools(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("ListTools code = %d, want 200", rec.Code)
	}
	var out struct {
		Tools []map[string]interface{} `json:"tools"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out.Tools) == 0 {
		t.Error("expected at least one builtin tool")
	}
}

func TestGetToolEnableState(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tools?state=1", nil)
	rec := httptest.NewRecorder()
	h.GetToolEnableState(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("GetToolEnableState code = %d, want 200", rec.Code)
	}
	var out struct {
		Enabled map[string]bool `json:"enabled"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

func TestGetTool_Builtin(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tools/get_current_date", nil)
	rec := httptest.NewRecorder()
	h.GetTool(rec, req, "get_current_date")
	if rec.Code != http.StatusOK {
		t.Errorf("GetTool code = %d, want 200", rec.Code)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["id"] != "get_current_date" {
		t.Errorf("id = %v, want get_current_date", out["id"])
	}
}

func TestGetTool_Mcp(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tools/mcp_abc__some_tool", nil)
	rec := httptest.NewRecorder()
	h.GetTool(rec, req, "mcp_abc__some_tool")
	if rec.Code != http.StatusOK {
		t.Errorf("GetTool mcp code = %d, want 200", rec.Code)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := out["enabled"]; !ok {
		t.Error("expected enabled field for mcp tool")
	}
}

func TestUpdateTool_Builtin(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"enabled":false}`)
	req := httptest.NewRequest(http.MethodPut, "/api/tools/get_current_date", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.UpdateTool(rec, req, "get_current_date")
	if rec.Code != http.StatusOK {
		t.Errorf("UpdateTool code = %d, want 200", rec.Code)
	}
	if h.toolEnable.GetEnabled("get_current_date") {
		t.Error("tool should be disabled after UpdateTool")
	}
}

func TestUpdateTool_Mcp(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"enabled":false}`)
	req := httptest.NewRequest(http.MethodPut, "/api/tools/mcp_xyz__read_file", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.UpdateTool(rec, req, "mcp_xyz__read_file")
	if rec.Code != http.StatusOK {
		t.Errorf("UpdateTool mcp code = %d, want 200", rec.Code)
	}
	if h.toolEnable.GetEnabled("mcp_xyz__read_file") {
		t.Error("mcp tool should be disabled")
	}
}

func TestUpdateTool_InvalidBody(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{}`)
	req := httptest.NewRequest(http.MethodPut, "/api/tools/get_current_date", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.UpdateTool(rec, req, "get_current_date")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("UpdateTool invalid body code = %d, want 400", rec.Code)
	}
}
