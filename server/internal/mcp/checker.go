// Package mcp 实现 MCP 服务器的可用性检查，参考 use-mcp 与 dist-server McpManager
package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	checkTimeout      = 10 * time.Second
	sseReadTimeout    = 8 * time.Second // 等待 endpoint 事件的最长时间
	clientName        = "AgenticDemo"
	protocolVersion   = "2024-11-05"
)

// CheckResult 可用性检查结果
type CheckResult struct {
	Status      string // ready | reachable | failed
	Error       string
	ToolsCount  int
	Endpoint    string
}

// Check 对 MCP 服务器执行可用性检查，流程参考 use-mcp 与 dist-server：
// 1. GET url with Accept: text/event-stream (SSE)
// 2. 解析 SSE 流中的 event: endpoint 与 data: <post_url>
// 3. 若有 endpoint，则 POST Initialize + tools/list 完成全链路验证
func Check(ctx context.Context, serverURL string) (*CheckResult, error) {
	u, err := url.Parse(serverURL)
	if err != nil {
		return &CheckResult{Status: "failed", Error: "invalid URL: " + err.Error()}, nil
	}
	if u.Scheme == "" || u.Host == "" {
		return &CheckResult{Status: "failed", Error: "URL must have scheme and host"}, nil
	}

	// 1. 创建带超时的 HTTP 请求
	reqCtx, cancel := context.WithTimeout(ctx, checkTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, serverURL, nil)
	if err != nil {
		return &CheckResult{Status: "failed", Error: err.Error()}, nil
	}
	req.Header.Set("Accept", "application/json, text/event-stream")

	client := &http.Client{Timeout: checkTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return &CheckResult{Status: "failed", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &CheckResult{
			Status: "failed",
			Error:  fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status),
		}, nil
	}

	// 2. 解析 SSE 流，查找 event: endpoint 与 data:
	ct := resp.Header.Get("Content-Type")
	isSSE := strings.Contains(ct, "text/event-stream")
	var endpoint string
	if isSSE {
		endpoint = parseSSEEndpoint(resp.Body, serverURL, sseReadTimeout)
	} else {
		// 可能是 Streamable HTTP，直接尝试对原 URL 发 JSON-RPC
		endpoint = serverURL
	}

	if endpoint == "" {
		return &CheckResult{
			Status: "reachable",
			Error:  "SSE 响应正常但未在超时内收到 endpoint 事件",
		}, nil
	}

	// 3. 对 endpoint 发送 Initialize + tools/list，完成全链路验证
	toolsCount, initErr := initializeAndListTools(ctx, endpoint)
	if initErr != nil {
		return &CheckResult{
			Status:   "reachable",
			Error:    "endpoint 已获取但初始化失败: " + initErr.Error(),
			Endpoint: endpoint,
		}, nil
	}

	return &CheckResult{
		Status:     "ready",
		ToolsCount: toolsCount,
		Endpoint:   endpoint,
	}, nil
}

func parseSSEEndpoint(r io.Reader, baseURL string, timeout time.Duration) string {
	type result struct {
		endpoint string
	}
	done := make(chan result, 1)
	go func() {
		var endpoint string
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		var eventType, dataLine string
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "event: ") {
				eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			} else if strings.HasPrefix(line, "data: ") {
				dataLine = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			} else if line == "" && eventType != "" && dataLine != "" {
				if eventType == "endpoint" {
					raw := strings.Trim(strings.TrimSpace(dataLine), `"`)
					if base, err := url.Parse(baseURL); err == nil {
						if resolved, err := base.Parse(raw); err == nil {
							endpoint = resolved.String()
						} else {
							endpoint = raw
						}
					} else {
						endpoint = raw
					}
					break
				}
				eventType = ""
				dataLine = ""
			}
		}
		done <- result{endpoint: endpoint}
	}()

	select {
	case res := <-done:
		return res.endpoint
	case <-time.After(timeout):
		return ""
	}
}

// initializeAndListTools 发送 MCP Initialize 与 tools/list，返回工具数量
func initializeAndListTools(ctx context.Context, endpoint string) (int, error) {
	// Initialize
	initReq := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": protocolVersion,
			"capabilities":    map[string]any{},
			"clientInfo":     map[string]any{"name": clientName, "version": "1.0.0"},
		},
	}
	initBody, _ := json.Marshal(initReq)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(initBody))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("initialize: HTTP %d", resp.StatusCode)
	}

	// notifications/initialized (可选，部分服务器不要求)
	notifReq := map[string]any{
		"jsonrpc": "2.0",
		"method":  "notifications/initialized",
	}
	notifBody, _ := json.Marshal(notifReq)
	notif, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(notifBody))
	notif.Header.Set("Content-Type", "application/json")
	_ = client.Do(notif)

	// tools/list
	toolsReq := map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
	}
	toolsBody, _ := json.Marshal(toolsReq)
	toolsHTTPReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(toolsBody))
	if err != nil {
		return 0, err
	}
	toolsHTTPReq.Header.Set("Content-Type", "application/json")
	toolsHTTPReq.Header.Set("Accept", "application/json")
	toolsResp, err := client.Do(toolsHTTPReq)
	if err != nil {
		return 0, err
	}
	defer toolsResp.Body.Close()
	if toolsResp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("tools/list: HTTP %d", toolsResp.StatusCode)
	}
	var toolsRes struct {
		Result *struct {
			Tools []map[string]any `json:"tools"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(toolsResp.Body).Decode(&toolsRes); err != nil {
		return 0, err
	}
	if toolsRes.Error != nil {
		return 0, fmt.Errorf("tools/list: %s", toolsRes.Error.Message)
	}
	if toolsRes.Result == nil {
		return 0, nil
	}
	return len(toolsRes.Result.Tools), nil
}
