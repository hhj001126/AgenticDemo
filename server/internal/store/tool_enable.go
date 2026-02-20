package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

const toolEnableFile = "tool_enable.json"

type ToolEnableStore struct {
	mu   sync.RWMutex
	dir  string
	data map[string]bool
}

func NewToolEnableStore(dir string) (*ToolEnableStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	s := &ToolEnableStore{dir: dir, data: make(map[string]bool)}
	_ = s.load()
	return s, nil
}

func (s *ToolEnableStore) filePath() string {
	return filepath.Join(s.dir, toolEnableFile)
}

func (s *ToolEnableStore) load() error {
	data, err := os.ReadFile(s.filePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var parsed map[string]bool
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	s.data = parsed
	if s.data == nil {
		s.data = make(map[string]bool)
	}
	return nil
}

func (s *ToolEnableStore) save() error {
	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(), data, 0644)
}

// GetEnabled 获取工具是否启用，未配置时默认 true
func (s *ToolEnableStore) GetEnabled(id string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if v, ok := s.data[id]; ok {
		return v
	}
	return true
}

// SetEnabled 设置工具启用状态
func (s *ToolEnableStore) SetEnabled(id string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[id] = enabled
	return s.save()
}

// GetAll 返回所有已配置的 id -> enabled 映射
func (s *ToolEnableStore) GetAll() map[string]bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]bool, len(s.data))
	for k, v := range s.data {
		out[k] = v
	}
	return out
}
