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

func initTestHandler(t *testing.T) *Handler {
	dir := t.TempDir()
	sessionsDir := filepath.Join(dir, "sessions")
	dataDir := filepath.Join(dir, "data")
	_ = os.MkdirAll(sessionsDir, 0755)
	s, err := store.NewSessionStore(sessionsDir)
	if err != nil {
		t.Fatalf("NewSessionStore: %v", err)
	}
	todoStore := store.NewTodoStore(dataDir)
	reg := registry.New()
	setup.RegisterBuiltinTools(reg)
	return NewHandler(s, todoStore, reg)
}

func TestCreateSession(t *testing.T) {
	h := initTestHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", nil)
	rec := httptest.NewRecorder()
	h.CreateSession(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("CreateSession code = %d, want 200", rec.Code)
	}
	var out struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.SessionID == "" {
		t.Error("sessionId is empty")
	}
}

func TestListSessions(t *testing.T) {
	h := initTestHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	rec := httptest.NewRecorder()
	h.ListSessions(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("ListSessions code = %d, want 200", rec.Code)
	}
}

func TestGetSession_OK(t *testing.T) {
	h := initTestHandler(t)
	id, err := h.store.CreateSession()
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/"+id, nil)
	rec := httptest.NewRecorder()
	h.GetSession(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("GetSession code = %d, want 200", rec.Code)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["sessionId"] != id {
		t.Errorf("sessionId = %v, want %s", out["sessionId"], id)
	}
}

func TestSwitchSession(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	req := httptest.NewRequest(http.MethodPut, "/api/sessions/"+id+"/active", nil)
	rec := httptest.NewRecorder()
	h.SwitchSession(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("SwitchSession code = %d, want 200", rec.Code)
	}
	if h.store.GetActiveSessionID() != id {
		t.Error("active session not updated")
	}
}

func TestDeleteSession(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	req := httptest.NewRequest(http.MethodDelete, "/api/sessions/"+id, nil)
	rec := httptest.NewRecorder()
	h.DeleteSession(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("DeleteSession code = %d, want 200", rec.Code)
	}
	_, err := h.store.GetSession(id)
	if err == nil {
		t.Error("session should be deleted")
	}
}

func TestClearSessionContent(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	req := httptest.NewRequest(http.MethodPut, "/api/sessions/"+id+"/clear", nil)
	rec := httptest.NewRecorder()
	h.ClearSessionContent(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("ClearSessionContent code = %d, want 200", rec.Code)
	}
	sess, _ := h.store.GetSession(id)
	if len(sess.UIMessages) != 0 || len(sess.GeminiHistory) != 0 {
		t.Error("session content should be cleared")
	}
}

func TestGetActiveSession(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	_ = h.store.SetActiveSession(id)
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/active", nil)
	rec := httptest.NewRecorder()
	h.GetActiveSession(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("GetActiveSession code = %d, want 200", rec.Code)
	}
	var out struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.SessionID != id {
		t.Errorf("sessionId = %s, want %s", out.SessionID, id)
	}
}

func TestGetSession_NotFound(t *testing.T) {
	h := initTestHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/nonexistent", nil)
	rec := httptest.NewRecorder()
	h.GetSession(rec, req, "nonexistent")
	if rec.Code != http.StatusNotFound {
		t.Errorf("GetSession code = %d, want 404", rec.Code)
	}
}

func TestUpdateSessionTitle(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	body := bytes.NewBufferString(`{"title":"新标题"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/sessions/"+id+"/title", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.UpdateSessionTitle(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("UpdateSessionTitle code = %d, want 200", rec.Code)
	}
}

func TestAppendSessionChunks(t *testing.T) {
	h := initTestHandler(t)
	id, _ := h.store.CreateSession()
	body := bytes.NewBufferString(`{"chunks":[{"content":"c1","summary":"s1","boundaryReason":"r1"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/sessions/"+id+"/chunks", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AppendSessionChunks(rec, req, id)
	if rec.Code != http.StatusOK {
		t.Errorf("AppendSessionChunks code = %d, want 200", rec.Code)
	}
	sess, _ := h.store.GetSession(id)
	if len(sess.KnowledgeChunks) != 1 {
		t.Errorf("chunks count = %d, want 1", len(sess.KnowledgeChunks))
	}
	if sess.KnowledgeChunks[0].Content != "c1" {
		t.Errorf("chunk content = %q, want c1", sess.KnowledgeChunks[0].Content)
	}
}

