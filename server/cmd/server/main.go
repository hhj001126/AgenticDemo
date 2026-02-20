package main

import (
	"log"
	"net/http"
	"strings"

	"agentic-demo/server/internal/config"
	"agentic-demo/server/internal/handler"
	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/setup"
	"agentic-demo/server/internal/store"
)

func main() {
	config.Load()
	if config.GeminiAPIKey == "" {
		log.Println("Warning: GEMINI_API_KEY not set")
	}

	s, err := store.NewSessionStore(config.SessionsDir)
	if err != nil {
		log.Fatalf("init session store: %v", err)
	}

	todoStore := store.NewTodoStore(config.DataDir)
	toolEnableStore, err := store.NewToolEnableStore(config.DataDir)
	if err != nil {
		log.Fatalf("init tool enable store: %v", err)
	}
	mcpStore, err := store.NewMcpStore(config.DataDir)
	if err != nil {
		log.Fatalf("init mcp store: %v", err)
	}
	mcpStatusStore, err := store.NewMcpStatusStore(config.DataDir)
	if err != nil {
		log.Fatalf("init mcp status store: %v", err)
	}
	// 确保已有 MCP 服务器都有状态条目
	for _, svr := range mcpStore.List() {
		mcpStatusStore.EnsureEntry(svr.ID)
	}

	reg := registry.Global()
	setup.RegisterBuiltinTools(reg)

	h := handler.NewHandlerWithTools(s, todoStore, reg, toolEnableStore, mcpStore, mcpStatusStore)
	mux := http.NewServeMux()

	mux.HandleFunc("/api/sessions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			h.CreateSession(w, r)
		case http.MethodGet:
			h.ListSessions(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/sessions/active", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h.GetActiveSession(w, r)
	})
	mux.HandleFunc("/api/chat/stream", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h.ChatStream(w, r)
	})

	mux.HandleFunc("/api/tools", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Query().Get("state") == "1" {
			h.GetToolEnableState(w, r)
			return
		}
		h.ListTools(w, r)
	})
	mux.HandleFunc("/api/tools/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/tools/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 || parts[0] == "" {
			http.NotFound(w, r)
			return
		}
		id := parts[0]
		switch r.Method {
		case http.MethodGet:
			h.GetTool(w, r, id)
		case http.MethodPut:
			h.UpdateTool(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/mcp/servers", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListMcpServers(w, r)
		case http.MethodPost:
			h.AddMcpServer(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/mcp/servers/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/mcp/servers/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 || parts[0] == "" {
			http.NotFound(w, r)
			return
		}
		id := parts[0]
		switch {
		case len(parts) == 2 && parts[1] == "check" && r.Method == http.MethodPost:
			h.CheckMcpServer(w, r, id)
		case len(parts) == 2 && parts[1] == "status" && r.Method == http.MethodGet:
			h.GetMcpServerStatus(w, r, id)
		case len(parts) == 1 && r.Method == http.MethodPut:
			h.UpdateMcpServer(w, r, id)
		case len(parts) == 1 && r.Method == http.MethodDelete:
			h.DeleteMcpServer(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/sessions/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 || parts[0] == "" {
			http.NotFound(w, r)
			return
		}
		id := parts[0]
		switch {
		case len(parts) == 1 && r.Method == http.MethodGet:
			h.GetSession(w, r, id)
		case len(parts) == 2 && parts[1] == "active" && r.Method == http.MethodPut:
			h.SwitchSession(w, r, id)
		case len(parts) == 1 && r.Method == http.MethodDelete:
			h.DeleteSession(w, r, id)
		case len(parts) == 2 && parts[1] == "title" && r.Method == http.MethodPut:
			h.UpdateSessionTitle(w, r, id)
		case len(parts) == 2 && parts[1] == "clear" && r.Method == http.MethodPut:
			h.ClearSessionContent(w, r, id)
		case len(parts) == 2 && parts[1] == "chunks" && r.Method == http.MethodPost:
			h.AppendSessionChunks(w, r, id)
		default:
			http.NotFound(w, r)
		}
	})

	addr := ":" + config.Port
	log.Printf("Server listening on %s", addr)
	if err := http.ListenAndServe(addr, corsMiddleware(mux)); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
