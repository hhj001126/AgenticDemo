package registry

import (
	"context"
	"encoding/json"
	"sync"

	"agentic-demo/server/internal/registry/builtin"
	"agentic-demo/server/internal/store"

	"google.golang.org/genai"
)

var (
	global *Registry
	once   sync.Once
)

func Global() *Registry {
	once.Do(func() {
		global = New()
	})
	return global
}

type Registry struct {
	mu    sync.RWMutex
	tools map[string]*ToolDef
}

type ToolDef struct {
	Definition *genai.FunctionDeclaration
	Blocking   bool
}

// ExecuteRequest contains context for tool execution.
type ExecuteRequest struct {
	Ctx          context.Context
	SessionID    string
	Store        *store.SessionStore
	TodoStore    *store.TodoStore
	GeminiClient *genai.Client
	OnProgress   func(string)
}

func New() *Registry {
	return &Registry{tools: make(map[string]*ToolDef)}
}

func (r *Registry) Register(id string, def *genai.FunctionDeclaration, blocking bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[id] = &ToolDef{Definition: def, Blocking: blocking}
}

func (r *Registry) GetDefinitions() []*genai.FunctionDeclaration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*genai.FunctionDeclaration
	for _, t := range r.tools {
		if t.Definition != nil {
			list = append(list, t.Definition)
		}
	}
	return list
}

// GetIDs returns all registered tool IDs.
func (r *Registry) GetIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0, len(r.tools))
	for id := range r.tools {
		ids = append(ids, id)
	}
	return ids
}

// GetTool returns definition and blocking for a tool ID.
func (r *Registry) GetTool(id string) (*genai.FunctionDeclaration, bool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[id]
	if !ok || t.Definition == nil {
		return nil, false, false
	}
	return t.Definition, t.Blocking, true
}

// GetDefinitionsEnabled returns only tools that are enabled (enabled(id)==true).
// If isEnabled is nil, all tools are returned.
func (r *Registry) GetDefinitionsEnabled(isEnabled func(id string) bool) []*genai.FunctionDeclaration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*genai.FunctionDeclaration
	for id, t := range r.tools {
		if t.Definition != nil && (isEnabled == nil || isEnabled(id)) {
			list = append(list, t.Definition)
		}
	}
	return list
}

func (r *Registry) GetBlockingIDs() map[string]bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m := make(map[string]bool)
	for id, t := range r.tools {
		if t.Blocking {
			m[id] = true
		}
	}
	return m
}

func (r *Registry) Execute(req ExecuteRequest, name string, args json.RawMessage) (interface{}, error) {
	exec, ok := builtin.GetExecutor(name)
	if !ok {
		return nil, nil
	}
	ec := builtin.ExecutorContext{
		Ctx:          req.Ctx,
		SessionID:    req.SessionID,
		Store:        req.Store,
		TodoStore:    req.TodoStore,
		GeminiClient: req.GeminiClient,
		OnProgress:   req.OnProgress,
	}
	return exec(ec, args)
}
