package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"agentic-demo/server/internal/mcp"
	"agentic-demo/server/internal/store"
)

type mcpServerResp struct {
	ID          string `json:"id"`
	Name        string `json:"name,omitempty"`
	URL         string `json:"url"`
	Status      string `json:"status,omitempty"`
	LastError   string `json:"lastError,omitempty"`
	ToolsCount  int    `json:"toolsCount,omitempty"`
	LastCheckAt int64  `json:"lastCheckAt,omitempty"`
}

func (h *Handler) ListMcpServers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStore == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp store not configured"})
		return
	}
	list := h.mcpStore.List()
	out := make([]mcpServerResp, len(list))
	for i, s := range list {
		out[i] = mcpServerResp{ID: s.ID, Name: s.Name, URL: s.URL}
		if h.mcpStatus != nil {
			if st := h.mcpStatus.Get(s.ID); st != nil {
				out[i].Status = st.Status
				out[i].LastError = st.LastError
				out[i].ToolsCount = st.ToolsCount
				out[i].LastCheckAt = st.LastCheckAt
			}
		}
	}
	writeJSON(w, out)
}

func (h *Handler) AddMcpServer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStore == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp store not configured"})
		return
	}
	var body struct {
		URL  string `json:"url"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	body.URL = strings.TrimSpace(body.URL)
	if body.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{"error": "url required"})
		return
	}
	svr, err := h.mcpStore.Add(body.Name, body.URL)
	if err != nil {
		if errors.Is(err, store.ErrMcpExists) {
			writeJSONStatus(w, http.StatusConflict, map[string]string{"error": "该 MCP 地址已存在"})
			return
		}
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if h.mcpStatus != nil {
		h.mcpStatus.EnsureEntry(svr.ID)
	}
	writeJSONStatus(w, http.StatusCreated, mcpServerResp{ID: svr.ID, Name: svr.Name, URL: svr.URL})
}

func (h *Handler) UpdateMcpServer(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStore == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp store not configured"})
		return
	}
	var body struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	updates := make(map[string]string)
	if body.Name != "" {
		updates["name"] = strings.TrimSpace(body.Name)
	}
	if body.URL != "" {
		updates["url"] = strings.TrimSpace(body.URL)
	}
	if len(updates) == 0 {
		svr, _ := h.mcpStore.Get(id)
		if svr == nil {
			writeJSONStatus(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, mcpServerResp{ID: svr.ID, Name: svr.Name, URL: svr.URL})
		return
	}
	if err := h.mcpStore.Update(id, updates); err != nil {
		if errors.Is(err, store.ErrMcpExists) {
			writeJSONStatus(w, http.StatusConflict, map[string]string{"error": "该 MCP 地址已被其他服务器使用"})
			return
		}
		if errors.Is(err, store.ErrMcpNotFound) {
			writeJSONStatus(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	svr, _ := h.mcpStore.Get(id)
	if svr != nil {
		writeJSON(w, mcpServerResp{ID: svr.ID, Name: svr.Name, URL: svr.URL})
	} else {
		writeJSONStatus(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func (h *Handler) DeleteMcpServer(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStore == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp store not configured"})
		return
	}
	if err := h.mcpStore.Remove(id); err != nil {
		if errors.Is(err, store.ErrMcpNotFound) {
			writeJSONStatus(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if h.mcpStatus != nil {
		h.mcpStatus.RemoveServer(id)
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

// CheckMcpServer 触发 MCP 服务器的可用性检查
func (h *Handler) CheckMcpServer(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStore == nil || h.mcpStatus == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp store or status not configured"})
		return
	}
	svr, _ := h.mcpStore.Get(id)
	if svr == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	h.mcpStatus.EnsureEntry(id)
	h.mcpStatus.SetChecking(id)

	result, _ := mcp.Check(r.Context(), svr.URL)
	h.mcpStatus.SetResult(id, result.Status, result.Error, result.ToolsCount, result.Endpoint)

	writeJSON(w, map[string]interface{}{
		"id":         id,
		"status":     result.Status,
		"error":      result.Error,
		"toolsCount": result.ToolsCount,
	})
}

// GetMcpServerStatus 获取单个 MCP 服务器的状态
func (h *Handler) GetMcpServerStatus(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mcpStatus == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "mcp status not configured"})
		return
	}
	st := h.mcpStatus.Get(id)
	if st == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, map[string]interface{}{
		"id":          id,
		"status":      st.Status,
		"lastCheckAt": st.LastCheckAt,
		"lastError":   st.LastError,
		"toolsCount":  st.ToolsCount,
	})
}
