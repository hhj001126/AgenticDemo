package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type TodoItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	DueAt     string `json:"dueAt,omitempty"`
	Priority  string `json:"priority,omitempty"`
	Completed bool   `json:"completed"`
	CreatedAt int64  `json:"createdAt"`
}

type TodoStore struct {
	mu   sync.RWMutex
	path string
}

func NewTodoStore(dataDir string) *TodoStore {
	return &TodoStore{
		path: filepath.Join(dataDir, "todos.json"),
	}
}

func (t *TodoStore) load() ([]TodoItem, error) {
	data, err := os.ReadFile(t.path)
	if err != nil {
		if os.IsNotExist(err) {
			return []TodoItem{}, nil
		}
		return nil, err
	}
	var items []TodoItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (t *TodoStore) save(items []TodoItem) error {
	dir := filepath.Dir(t.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(t.path, data, 0644)
}

func genTodoID() string {
	return fmt.Sprintf("todo_%x%05x", time.Now().UnixMilli(), time.Now().UnixNano()%0x100000)
}

func (t *TodoStore) List(includeCompleted bool) ([]TodoItem, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	items, err := t.load()
	if err != nil {
		return nil, err
	}
	if !includeCompleted {
		var filtered []TodoItem
		for _, it := range items {
			if !it.Completed {
				filtered = append(filtered, it)
			}
		}
		return filtered, nil
	}
	return items, nil
}

func (t *TodoStore) Add(title, dueAt, priority string) (TodoItem, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	items, err := t.load()
	if err != nil {
		return TodoItem{}, err
	}
	item := TodoItem{
		ID:        genTodoID(),
		Title:     title,
		DueAt:     dueAt,
		Priority:  priority,
		Completed: false,
		CreatedAt: time.Now().UnixMilli(),
	}
	items = append(items, item)
	return item, t.save(items)
}

func (t *TodoStore) Complete(id string) (bool, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	items, err := t.load()
	if err != nil {
		return false, err
	}
	for i := range items {
		if items[i].ID == id {
			items[i].Completed = true
			return true, t.save(items)
		}
	}
	return false, nil
}
