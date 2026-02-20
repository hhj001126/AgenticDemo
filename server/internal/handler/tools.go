package handler

import (
	"encoding/json"
	"net/http"
)

// ToolItem for API response
type ToolItem struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Blocking    bool                   `json:"blocking"`
	Enabled     bool                   `json:"enabled"`
	Source      string                 `json:"source"`
	Definition  map[string]interface{}  `json:"definition,omitempty"`
}

func (h *Handler) ListTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.toolEnable == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "tool enable store not configured"})
		return
	}
	var items []ToolItem
	for _, id := range h.registry.GetIDs() {
		def, blocking, ok := h.registry.GetTool(id)
		if !ok || def == nil {
			continue
		}
		items = append(items, ToolItem{
			ID:          id,
			Name:        def.Name,
			Description: def.Description,
			Blocking:    blocking,
			Enabled:     h.toolEnable.GetEnabled(id),
			Source:      "builtin",
		})
	}
	writeJSON(w, map[string]interface{}{"tools": items})
}

// GetToolEnableState 返回所有已配置的工具启用状态，供前端一次性拉取（含 MCP 等）
func (h *Handler) GetToolEnableState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.toolEnable == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "tool enable store not configured"})
		return
	}
	writeJSON(w, map[string]interface{}{"enabled": h.toolEnable.GetAll()})
}

func (h *Handler) GetTool(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.toolEnable == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "tool enable store not configured"})
		return
	}
	def, blocking, ok := h.registry.GetTool(id)
	if ok && def != nil {
		writeJSON(w, ToolItem{
			ID:          id,
			Name:        def.Name,
			Description: def.Description,
			Blocking:    blocking,
			Enabled:     h.toolEnable.GetEnabled(id),
			Source:      "builtin",
		})
		return
	}
	// MCP 等非 builtin：仅返回启用状态
	writeJSON(w, map[string]interface{}{
		"id": id, "enabled": h.toolEnable.GetEnabled(id), "source": "mcp",
	})
}

func (h *Handler) UpdateTool(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.toolEnable == nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": "tool enable store not configured"})
		return
	}
	// 支持任意工具 ID（含 builtin 与 MCP），仅持久化启用状态
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if body.Enabled == nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{"error": "enabled field required"})
		return
	}
	if err := h.toolEnable.SetEnabled(id, *body.Enabled); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, map[string]interface{}{
		"id":      id,
		"enabled": *body.Enabled,
	})
}
