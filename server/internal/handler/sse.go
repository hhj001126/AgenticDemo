package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// SendEvent 向 text/event-stream 响应写入事件并立即 Flush
func SendEvent(w http.ResponseWriter, flusher http.Flusher, eventType string, data any) {
	body, err := json.Marshal(data)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, body)
	flusher.Flush()
}

// SetupSSE 设置 text/event-stream 响应头，返回 Flusher
func SetupSSE(w http.ResponseWriter) http.Flusher {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	return w.(http.Flusher)
}
