package handler

import (
	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/store"
)

type Handler struct {
	store        *store.SessionStore
	todoStore    *store.TodoStore
	registry     *registry.Registry
	toolEnable   *store.ToolEnableStore
	mcpStore     *store.McpStore
	mcpStatus    *store.McpStatusStore
}

func NewHandler(s *store.SessionStore, todoStore *store.TodoStore, reg *registry.Registry) *Handler {
	return &Handler{store: s, todoStore: todoStore, registry: reg}
}

func NewHandlerWithTools(s *store.SessionStore, todoStore *store.TodoStore, reg *registry.Registry,
	toolEnable *store.ToolEnableStore, mcpStore *store.McpStore, mcpStatus *store.McpStatusStore) *Handler {
	return &Handler{
		store: s, todoStore: todoStore, registry: reg,
		toolEnable: toolEnable, mcpStore: mcpStore, mcpStatus: mcpStatus,
	}
}
