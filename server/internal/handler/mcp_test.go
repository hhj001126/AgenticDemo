package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListMcpServers(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/mcp/servers", nil)
	rec := httptest.NewRecorder()
	h.ListMcpServers(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("ListMcpServers code = %d, want 200", rec.Code)
	}
}

func TestAddMcpServer(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"url":"http://localhost:5201/mcp","name":"mcp-utils"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddMcpServer(rec, req)
	if rec.Code != http.StatusCreated {
		t.Errorf("AddMcpServer code = %d, want 201", rec.Code)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["id"] == nil || out["url"] != "http://localhost:5201/mcp" {
		t.Errorf("unexpected response: %v", out)
	}
}

func TestAddMcpServer_DuplicateUrl(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"url":"http://localhost:5202/mcp"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddMcpServer(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("first add: code = %d", rec.Code)
	}
	body2 := bytes.NewBufferString(`{"url":"http://localhost:5202/mcp"}`)
	req2 := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	h.AddMcpServer(rec2, req2)
	if rec2.Code != http.StatusConflict {
		t.Errorf("duplicate add code = %d, want 409", rec2.Code)
	}
}

func TestUpdateMcpServer(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"url":"http://localhost:5203/mcp"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddMcpServer(rec, req)
	var addOut map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &addOut)
	id := addOut["id"].(string)

	updateBody := bytes.NewBufferString(`{"name":"mcp-notes-updated"}`)
	upReq := httptest.NewRequest(http.MethodPut, "/api/mcp/servers/"+id, updateBody)
	upReq.Header.Set("Content-Type", "application/json")
	upRec := httptest.NewRecorder()
	h.UpdateMcpServer(upRec, upReq, id)
	if upRec.Code != http.StatusOK {
		t.Errorf("UpdateMcpServer code = %d, want 200", upRec.Code)
	}
	svr, _ := h.mcpStore.Get(id)
	if svr == nil {
		t.Fatal("server should exist after update")
	}
	if svr.Name != "mcp-notes-updated" {
		t.Errorf("name = %q, want mcp-notes-updated", svr.Name)
	}
}

func TestDeleteMcpServer(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"url":"http://localhost:5204/mcp"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddMcpServer(rec, req)
	var addOut map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &addOut)
	id := addOut["id"].(string)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/mcp/servers/"+id, nil)
	delRec := httptest.NewRecorder()
	h.DeleteMcpServer(delRec, delReq, id)
	if delRec.Code != http.StatusOK {
		t.Errorf("DeleteMcpServer code = %d, want 200", delRec.Code)
	}
	svr, _ := h.mcpStore.Get(id)
	if svr != nil {
		t.Error("server should be deleted")
	}
}

func TestDeleteMcpServer_NotFound(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/mcp/servers/nonexistent", nil)
	rec := httptest.NewRecorder()
	h.DeleteMcpServer(rec, req, "nonexistent")
	if rec.Code != http.StatusNotFound {
		t.Errorf("DeleteMcpServer notfound code = %d, want 404", rec.Code)
	}
}

func TestGetMcpServerStatus(t *testing.T) {
	h := initTestHandlerWithTools(t)
	body := bytes.NewBufferString(`{"url":"http://localhost:5205/mcp"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddMcpServer(rec, req)
	var addOut map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &addOut)
	id := addOut["id"].(string)

	h.mcpStatus.EnsureEntry(id)
	statusReq := httptest.NewRequest(http.MethodGet, "/api/mcp/servers/"+id+"/status", nil)
	statusRec := httptest.NewRecorder()
	h.GetMcpServerStatus(statusRec, statusReq, id)
	if statusRec.Code != http.StatusOK {
		t.Errorf("GetMcpServerStatus code = %d, want 200", statusRec.Code)
	}
}

func TestGetMcpServerStatus_NotFound(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodGet, "/api/mcp/servers/nonexistent/status", nil)
	rec := httptest.NewRecorder()
	h.GetMcpServerStatus(rec, req, "nonexistent")
	if rec.Code != http.StatusNotFound {
		t.Errorf("GetMcpServerStatus notfound code = %d, want 404", rec.Code)
	}
}

func TestCheckMcpServer_NotFound(t *testing.T) {
	h := initTestHandlerWithTools(t)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/servers/nonexistent/check", nil)
	rec := httptest.NewRecorder()
	h.CheckMcpServer(rec, req, "nonexistent")
	if rec.Code != http.StatusNotFound {
		t.Errorf("CheckMcpServer notfound code = %d, want 404", rec.Code)
	}
}
