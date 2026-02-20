package handler

import (
	"encoding/json"
	"net/http"

	"agentic-demo/server/internal/store"
)

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id, err := h.store.CreateSession()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"sessionId": id})
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	metas, err := h.store.ListSessions()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, metas)
}

func (h *Handler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := h.store.GetActiveSessionID()
	writeJSON(w, map[string]string{"sessionId": id})
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state, err := h.store.GetSession(sessionID)
	if err != nil || state == nil {
		writeJSONError(w, http.StatusNotFound, "session not found")
		return
	}
	writeJSON(w, state)
}

func (h *Handler) SwitchSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.store.SetActiveSession(sessionID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"sessionId": sessionID})
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.store.DeleteSession(sessionID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]bool{"success": true})
}

func (h *Handler) UpdateSessionTitle(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.store.UpdateSession(sessionID, map[string]any{"title": body.Title}); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]bool{"success": true})
}

func (h *Handler) ClearSessionContent(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.store.ClearSessionContent(sessionID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]bool{"success": true})
}

func (h *Handler) AppendSessionChunks(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Chunks []store.KnowledgeChunk `json:"chunks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Chunks) == 0 {
		writeJSON(w, map[string]bool{"success": true})
		return
	}
	if err := h.store.AppendKnowledgeChunks(sessionID, body.Chunks); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]bool{"success": true})
}
