package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

var (
	ErrMcpExists   = errors.New("mcp url already exists")
	ErrMcpNotFound = errors.New("mcp server not found")
)

const mcpServersFile = "mcp_servers.json"

type McpServer struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
	URL  string `json:"url"`
}

type McpStore struct {
	mu      sync.RWMutex
	dir     string
	servers []McpServer
}

func NewMcpStore(dir string) (*McpStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	s := &McpStore{dir: dir, servers: []McpServer{}}
	_ = s.load()
	return s, nil
}

func (s *McpStore) filePath() string {
	return filepath.Join(s.dir, mcpServersFile)
}

func (s *McpStore) load() error {
	data, err := os.ReadFile(s.filePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var parsed []McpServer
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	s.servers = parsed
	if s.servers == nil {
		s.servers = []McpServer{}
	}
	return nil
}

func (s *McpStore) save() error {
	data, err := json.MarshalIndent(s.servers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(), data, 0644)
}

func (s *McpStore) List() []McpServer {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]McpServer, len(s.servers))
	copy(out, s.servers)
	return out
}

func (s *McpStore) Get(id string) (*McpServer, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i, svr := range s.servers {
		if svr.ID == id {
			c := svr
			return &c, i
		}
	}
	return nil, -1
}

func (s *McpStore) Add(name, url string) (McpServer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	norm := normalizeMcpUrl(url)
	for _, svr := range s.servers {
		if normalizeMcpUrl(svr.URL) == norm {
			return McpServer{}, ErrMcpExists
		}
	}
	id := genMcpID()
	svr := McpServer{ID: id, Name: name, URL: url}
	s.servers = append(s.servers, svr)
	if err := s.save(); err != nil {
		return McpServer{}, err
	}
	return svr, nil
}

func (s *McpStore) Update(id string, updates map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.servers {
		if s.servers[i].ID == id {
			if name, ok := updates["name"]; ok {
				s.servers[i].Name = name
			}
			if url, ok := updates["url"]; ok {
				norm := normalizeMcpUrl(url)
				for j, other := range s.servers {
					if j != i && normalizeMcpUrl(other.URL) == norm {
						return ErrMcpExists
					}
				}
				s.servers[i].URL = url
			}
			return s.save()
		}
	}
	return ErrMcpNotFound
}

func (s *McpStore) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, svr := range s.servers {
		if svr.ID == id {
			s.servers = append(s.servers[:i], s.servers[i+1:]...)
			return s.save()
		}
	}
	return ErrMcpNotFound
}

func genMcpID() string {
	return "mcp_" + randomID()
}

func normalizeMcpUrl(url string) string {
	u := url
	for len(u) > 0 && (u[len(u)-1] == '/' || u[len(u)-1] == ' ') {
		u = u[:len(u)-1]
	}
	return u
}
