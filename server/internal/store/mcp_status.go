package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// McpServerStatus 表示 MCP 服务器的连接/可用性状态，与 use-mcp 的 state 对应
// discovering -> connecting -> loading -> ready，或 failed
const (
	McpStatusUnknown    = "unknown"    // 未检查
	McpStatusChecking   = "checking"    // 正在检查（对应 connecting）
	McpStatusReady      = "ready"      // 可用，对应 use-mcp 的 ready
	McpStatusFailed     = "failed"     // 检查失败
	McpStatusReachable  = "reachable"  // 仅 SSE 可达，未完成 tools/list
)

type McpServerStatusEntry struct {
	Status      string `json:"status"`
	LastCheckAt int64  `json:"lastCheckAt"`
	LastError   string `json:"lastError,omitempty"`
	ToolsCount  int    `json:"toolsCount,omitempty"`
	Endpoint    string `json:"endpoint,omitempty"` // 从 SSE endpoint 事件解析出的 POST 地址
}

type McpStatusStore struct {
	mu   sync.RWMutex
	dir  string
	byID map[string]*McpServerStatusEntry
}

const mcpStatusFile = "mcp_status.json"

type mcpStatusPersist struct {
	Entries map[string]McpServerStatusEntry `json:"entries"` // key: server ID
}

func NewMcpStatusStore(dir string) (*McpStatusStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	s := &McpStatusStore{dir: dir, byID: make(map[string]*McpServerStatusEntry)}
	_ = s.load()
	return s, nil
}

func (s *McpStatusStore) filePath() string {
	return filepath.Join(s.dir, mcpStatusFile)
}

func (s *McpStatusStore) load() error {
	data, err := os.ReadFile(s.filePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var p mcpStatusPersist
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, e := range p.Entries {
		ent := e
		s.byID[id] = &ent
	}
	return nil
}

func (s *McpStatusStore) save() error {
	s.mu.RLock()
	p := mcpStatusPersist{Entries: make(map[string]McpServerStatusEntry)}
	for id, e := range s.byID {
		if e != nil {
			p.Entries[id] = *e
		}
	}
	s.mu.RUnlock()
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(), data, 0644)
}

// EnsureEntry 确保某 ID 有状态条目（添加/更新服务器时调用）
func (s *McpStatusStore) EnsureEntry(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[id]; !ok {
		s.byID[id] = &McpServerStatusEntry{Status: McpStatusUnknown}
		s.save()
	}
}

// RemoveServer 在删除 MCP 服务器时调用
func (s *McpStatusStore) RemoveServer(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.byID, id)
	s.save()
}

// Get 获取指定 ID 的状态
func (s *McpStatusStore) Get(id string) *McpServerStatusEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if e, ok := s.byID[id]; ok {
		cpy := *e
		return &cpy
	}
	return nil
}

// SetChecking 设置为正在检查
func (s *McpStatusStore) SetChecking(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.byID[id]; ok {
		e.Status = McpStatusChecking
		e.LastCheckAt = time.Now().UnixMilli()
		e.LastError = ""
		s.save()
	}
}

// SetResult 设置检查结果；若条目不存在则先创建
func (s *McpStatusStore) SetResult(id string, status string, errMsg string, toolsCount int, endpoint string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[id]; !ok {
		s.byID[id] = &McpServerStatusEntry{Status: McpStatusUnknown}
	}
	if e := s.byID[id]; e != nil {
		e.Status = status
		e.LastCheckAt = time.Now().UnixMilli()
		e.LastError = errMsg
		e.ToolsCount = toolsCount
		if endpoint != "" {
			e.Endpoint = endpoint
		}
		s.save()
	}
}
