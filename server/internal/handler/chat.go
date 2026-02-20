package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"agentic-demo/server/internal/agent"
	"agentic-demo/server/internal/config"
	"agentic-demo/server/internal/store"
)

type ChatStreamRequest struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
	Params    *struct {
		ResumePlan         interface{} `json:"resumePlan"`
		IsApprovalConfirmed bool        `json:"isApprovalConfirmed"`
		PlanMsgID          string      `json:"planMsgId"`
		Options            *struct {
			Mode    string `json:"mode"`
			Industry string `json:"industry"`
		} `json:"options"`
	} `json:"params"`
}

func (h *Handler) ChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ChatStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.SessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "sessionId is required")
		return
	}
	if config.GeminiAPIKey == "" {
		writeJSONError(w, http.StatusInternalServerError, "GEMINI_API_KEY not configured")
		return
	}

	flusher, ok := SetupSSE(w)
	if !ok {
		writeJSONError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	opts := agent.SupervisorOptions{
		Industry: "通用政企",
		Mode:     "智能编排",
	}
	if req.Params != nil && req.Params.Options != nil {
		if req.Params.Options.Mode != "" {
			opts.Mode = req.Params.Options.Mode
		}
		if req.Params.Options.Industry != "" {
			opts.Industry = req.Params.Options.Industry
		}
	}

	callbacks := agent.Callbacks{
		OnThinking: func(step map[string]any) {
			SendEvent(w, flusher, "thinking", map[string]any{"step": step})
		},
		OnText: func(content string) {
			SendEvent(w, flusher, "text", map[string]string{"content": content})
		},
		OnPlanProposed: func(plan map[string]any) {
			SendEvent(w, flusher, "plan", map[string]any{"plan": plan})
		},
		OnChartData: func(data map[string]any) {
			SendEvent(w, flusher, "chart", map[string]any{"data": data})
		},
		OnFilesWritten: func(paths []string) {
			SendEvent(w, flusher, "files", map[string]any{"paths": paths})
		},
		OnPlanStepUpdate: func(msgID, stepID, status string) {
			SendEvent(w, flusher, "planUpdate", map[string]string{
				"msgId": msgID, "stepId": stepID, "status": status,
			})
		},
		OnToast: func(msg string) {
			SendEvent(w, flusher, "toast", map[string]string{"message": msg})
		},
	}

	err := agent.RunSupervisor(ctx, agent.SupervisorDeps{
		Store:      h.store,
		TodoStore:  h.todoStore,
		Registry:   h.registry,
		ToolEnable: h.toolEnable,
	}, req.SessionID, req.Message, opts, callbacks, req.Params)
	if err != nil {
		SendEvent(w, flusher, "error", map[string]string{"message": err.Error()})
		return
	}
	SendEvent(w, flusher, "done", map[string]any{})
}
