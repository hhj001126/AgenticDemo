package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"agentic-demo/server/internal/config"
	"agentic-demo/server/internal/prompts"
	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/registry/builtin"
	"agentic-demo/server/internal/store"

	"google.golang.org/genai"
)

type SupervisorOptions struct {
	Industry string
	Mode     string
}

type Callbacks struct {
	OnThinking       func(step map[string]any)
	OnText           func(content string)
	OnPlanProposed   func(plan map[string]any)
	OnChartData      func(data map[string]any)
	OnFilesWritten   func(paths []string)
	OnPlanStepUpdate func(msgID, stepID, status string)
	OnToast          func(msg string)
}

type SupervisorDeps struct {
	Store        *store.SessionStore
	TodoStore    *store.TodoStore
	Registry     *registry.Registry
	ToolEnable   *store.ToolEnableStore // optional: filter tools by enabled state
}

func RunSupervisor(
	ctx context.Context,
	deps SupervisorDeps,
	sessionID, message string,
	opts SupervisorOptions,
	cb Callbacks,
	params *struct {
		ResumePlan          interface{}
		IsApprovalConfirmed bool
		PlanMsgID           string
	},
) error {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  config.GeminiAPIKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return fmt.Errorf("create genai client: %w", err)
	}
	defer client.Close()

	session, err := deps.Store.GetSession(sessionID)
	if err != nil || session == nil {
		session = &store.AgentSessionState{
			SessionID:      sessionID,
			Title:          "新会话",
			GeminiHistory:  []any{},
			UIMessages:     []any{},
			VFS:            store.DefaultVFS(),
			KnowledgeChunks: []store.KnowledgeChunk{},
		}
		_ = deps.Store.SaveSession(sessionID, session)
	}

	history := session.GeminiHistory
	if history == nil {
		history = []any{}
	}

	userText := message
	if params != nil && params.IsApprovalConfirmed && params.ResumePlan != nil {
		userText = "计划已批准。请按计划立即开始执行。"
	}

	history = append(history, map[string]any{
		"role": "user",
		"parts": []any{map[string]string{"text": userText}},
	})

	systemInstruction := prompts.SupervisorSystem(prompts.SupervisorVars{
		Industry:        opts.Industry,
		Mode:            opts.Mode,
		HasMcpConnected: false,
	})

	var toolDefs []*genai.FunctionDeclaration
	if deps.ToolEnable != nil {
		toolDefs = deps.Registry.GetDefinitionsEnabled(deps.ToolEnable.GetEnabled)
	} else {
		toolDefs = deps.Registry.GetDefinitions()
	}
	blockingIDs := deps.Registry.GetBlockingIDs()

	userMsgID := fmt.Sprintf("u-%d", time.Now().UnixMilli())
	assistantMsgID := fmt.Sprintf("agent-%d", time.Now().UnixMilli())

	existingUIMessages := sliceAny(session.UIMessages)
	uiMessages := append(existingUIMessages, map[string]any{
		"id": userMsgID, "role": "user", "content": userText, "timestamp": time.Now().UnixMilli(),
	}, map[string]any{
		"id": assistantMsgID, "role": "assistant", "content": "", "thinkingSteps": []any{}, "timestamp": time.Now().UnixMilli(),
	})

	cfg := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{Parts: []*genai.Part{{Text: systemInstruction}}},
		Tools:             []*genai.Tool{{FunctionDeclarations: toolDefs}},
	}

	loopCount := 0
	currentTurnText := ""
	for loopCount < 10 {
		loopCount++
		contents := historyToContents(history)
		currentTurnText = ""
		var accumulatedParts []*genai.Part
		currentThought := ""
		thoughtStepID := fmt.Sprintf("th-%d", loopCount)
		writtenFilePaths := []string{}
		charts := []map[string]any{}
		thinkingSteps := []map[string]any{}

		for resp, err := range client.Models.GenerateContentStream(ctx, "gemini-2.0-flash", contents, cfg) {
			if err != nil {
				return err
			}
			if resp == nil || len(resp.Candidates) == 0 {
				continue
			}
			cand := resp.Candidates[0]
			if cand.Content == nil || len(cand.Content.Parts) == 0 {
				continue
			}
			for _, p := range cand.Content.Parts {
				if p.Text != "" {
					if currentThought != "" {
						if cb.OnThinking != nil {
							cb.OnThinking(thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
						}
						thinkingSteps = append(thinkingSteps, thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
						accumulatedParts = append(accumulatedParts, &genai.Part{Thought: currentThought})
						currentThought = ""
					}
					currentTurnText += p.Text
					if cb.OnText != nil {
						cb.OnText(currentTurnText)
					}
					if len(accumulatedParts) > 0 && accumulatedParts[len(accumulatedParts)-1].Text != "" {
						accumulatedParts[len(accumulatedParts)-1].Text += p.Text
					} else {
						accumulatedParts = append(accumulatedParts, &genai.Part{Text: p.Text})
					}
				} else if p.Thought != "" {
					currentThought += p.Thought
					if cb.OnThinking != nil {
						cb.OnThinking(thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "active", currentThought))
					}
					thinkingSteps = appendOrUpdate(thinkingSteps, thoughtStepID, thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "active", currentThought))
					accumulatedParts = append(accumulatedParts, &genai.Part{Thought: p.Thought})
				} else if p.FunctionCall != nil {
					if currentThought != "" {
						accumulatedParts = append(accumulatedParts, &genai.Part{Thought: currentThought})
						if cb.OnThinking != nil {
							cb.OnThinking(thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
						}
						thinkingSteps = appendOrUpdate(thinkingSteps, thoughtStepID, thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
						currentThought = ""
					}
					fc := p.FunctionCall
					fcID := fc.Id
					if fcID == "" {
						fcID = fmt.Sprintf("fc-%d-%x", time.Now().UnixMilli(), rand.Uint32())
						fc = &genai.FunctionCall{Name: fc.Name, Id: fcID, Args: fc.Args}
					}
					if fc.Name != "write_file" && fc.Name != "generate_chart" {
						label := toolLabel(fc.Name)
						if cb.OnThinking != nil {
							cb.OnThinking(thinkingStep("call-"+fcID, fc.Name, label, label, "pending", ""))
						}
						thinkingSteps = append(thinkingSteps, thinkingStep("call-"+fcID, fc.Name, label, label, "pending", ""))
					}
					accumulatedParts = append(accumulatedParts, &genai.Part{FunctionCall: fc})
				}
			}
		}

		if currentThought != "" {
			if cb.OnThinking != nil {
				cb.OnThinking(thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
			}
			thinkingSteps = appendOrUpdate(thinkingSteps, thoughtStepID, thinkingStep(thoughtStepID, "supervisor", "Supervisor", thoughtSummary(currentThought, 120), "completed", currentThought))
		}

		modelPartsForHistory := partsToHistory(accumulatedParts)
		history = append(history, map[string]any{
			"role":  "model",
			"parts": modelPartsForHistory,
		})

		var functionCalls []struct {
			Name string
			Id   string
			Args json.RawMessage
		}
		for _, p := range accumulatedParts {
			if p.FunctionCall != nil {
				functionCalls = append(functionCalls, struct {
					Name string
					Id   string
					Args json.RawMessage
				}{Name: p.FunctionCall.Name, Id: p.FunctionCall.Id, Args: p.FunctionCall.Args})
			}
		}

		if len(functionCalls) == 0 {
			break
		}

		hasPlanCall := false
		for _, fc := range functionCalls {
			if fc.Name == "propose_plan" {
				hasPlanCall = true
				break
			}
		}

		var responseParts []*genai.Part
		execReq := registry.ExecuteRequest{
			Ctx:          ctx,
			SessionID:    sessionID,
			Store:        deps.Store,
			TodoStore:    deps.TodoStore,
			GeminiClient: client,
			OnProgress:   nil,
		}

		blockingCalls := []struct {
			Name string
			Id   string
			Args json.RawMessage
		}{}
		nonBlockingCalls := []struct {
			Name string
			Id   string
			Args json.RawMessage
		}{}
		for _, fc := range functionCalls {
			if blockingIDs[fc.Name] {
				blockingCalls = append(blockingCalls, fc)
			} else {
				nonBlockingCalls = append(nonBlockingCalls, fc)
			}
		}

		for _, fc := range append(blockingCalls, nonBlockingCalls...) {
			if hasPlanCall && fc.Name != "propose_plan" {
				responseParts = append(responseParts, &genai.Part{
					FunctionResponse: &genai.FunctionResponse{
						Name: fc.Name,
						Id:   fc.Id,
						Response: map[string]any{
							"error": "Execution blocked: Plan must be approved first.",
						},
					},
				})
				continue
			}

			if fc.Name == "generate_chart" {
				var chartArgs map[string]any
				_ = json.Unmarshal(fc.Args, &chartArgs)
				if cb.OnChartData != nil {
					cb.OnChartData(chartArgs)
				}
				charts = append(charts, chartArgs)
				responseParts = append(responseParts, &genai.Part{
					FunctionResponse: &genai.FunctionResponse{Name: fc.Name, Id: fc.Id, Response: map[string]any{"status": "CHART_RENDERED"}},
				})
				continue
			}

			result, execErr := deps.Registry.Execute(execReq, fc.Name, fc.Args)
			stepID := "call-" + fc.Id
			label := toolLabel(fc.Name)

			if execErr != nil {
				if cb.OnThinking != nil {
					cb.OnThinking(thinkingStep(stepID, fc.Name, label, "Failed: "+execErr.Error(), "failed", execErr.Error()))
				}
				thinkingSteps = appendOrUpdate(thinkingSteps, stepID, thinkingStep(stepID, fc.Name, label, "Failed: "+execErr.Error(), "failed", execErr.Error()))
				responseParts = append(responseParts, &genai.Part{
					FunctionResponse: &genai.FunctionResponse{Name: fc.Name, Id: fc.Id, Response: map[string]any{"error": execErr.Error()}},
				})
				continue
			}

			if fc.Name == "report_step_done" && params != nil && params.PlanMsgID != "" && cb.OnPlanStepUpdate != nil {
				var res struct {
					StepID string `json:"stepId"`
				}
				if m, ok := result.(map[string]interface{}); ok {
					if sid, ok := m["stepId"].(string); ok {
						cb.OnPlanStepUpdate(params.PlanMsgID, sid, "completed")
					}
				}
				_ = res
			}

			if fc.Name == "propose_plan" {
				if m, ok := result.(map[string]interface{}); ok {
					if plan, ok := m["plan"].(map[string]interface{}); ok {
						plan["isApproved"] = false
						if cb.OnPlanProposed != nil {
							cb.OnPlanProposed(plan)
						}
					}
				}
			}

			if fc.Name == "write_file" {
				if m, ok := result.(map[string]interface{}); ok {
					if path, ok := m["path"].(string); ok {
						writtenFilePaths = append(writtenFilePaths, path)
						if cb.OnFilesWritten != nil {
							cb.OnFilesWritten(writtenFilePaths)
						}
					}
				}
			}

			if fc.Name != "write_file" && fc.Name != "generate_chart" {
				doneContent := label
				if m, ok := result.(map[string]interface{}); ok {
					if p, hasPlan := m["plan"]; hasPlan {
						if pm, ok := p.(map[string]interface{}); ok {
							if t, ok := pm["title"].(string); ok {
								doneContent = "Plan: " + t
							}
						}
					} else if a, hasAnalysis := m["analysis"]; hasAnalysis {
						if as, ok := a.(string); ok && len(as) > 80 {
							doneContent = as[:80] + "..."
						} else if as, ok := a.(string); ok {
							doneContent = as
						}
					}
				}
				if cb.OnThinking != nil {
					cb.OnThinking(thinkingStep(stepID, fc.Name, label, doneContent, "completed", fmt.Sprintf("%v", result)))
				}
				thinkingSteps = appendOrUpdate(thinkingSteps, stepID, thinkingStep(stepID, fc.Name, label, doneContent, "completed", fmt.Sprintf("%v", result)))
			}

			responseParts = append(responseParts, &genai.Part{
				FunctionResponse: &genai.FunctionResponse{Name: fc.Name, Id: fc.Id, Response: map[string]any{"result": result}},
			})
		}

		history = append(history, map[string]any{
			"role":  "user",
			"parts": functionResponsesToHistory(responseParts),
		})

		if hasPlanCall {
			break
		}
		if len(blockingCalls) > 0 {
			continue
		}
	}

	assistantMsg := map[string]any{
		"id":            assistantMsgID,
		"role":          "assistant",
		"content":       currentTurnText,
		"thinkingSteps": thinkingSteps,
		"timestamp":     time.Now().UnixMilli(),
	}
	if len(charts) > 0 {
		assistantMsg["charts"] = charts
	}
	if len(writtenFilePaths) > 0 {
		assistantMsg["writtenFiles"] = writtenFilePaths
	}

	finalUIMessages := make([]any, 0, len(uiMessages))
	replaced := false
	for _, m := range uiMessages {
		mm, ok := m.(map[string]any)
		if !ok {
			finalUIMessages = append(finalUIMessages, m)
			continue
		}
		if rid, _ := mm["id"].(string); rid == assistantMsgID {
			finalUIMessages = append(finalUIMessages, assistantMsg)
			replaced = true
		} else {
			finalUIMessages = append(finalUIMessages, mm)
		}
	}
	if !replaced {
		finalUIMessages = append(finalUIMessages, assistantMsg)
	}

	_ = deps.Store.UpdateSession(sessionID, map[string]any{
		"geminiHistory": history,
		"uiMessages":    finalUIMessages,
	})
	return nil
}

func gatherThinkingSteps(uiMessages []any, steps []map[string]any) []any {
	seen := make(map[string]bool)
	var out []any
	for _, s := range steps {
		id, _ := s["id"].(string)
		if !seen[id] {
			seen[id] = true
			out = append(out, s)
		}
	}
	return out
}

func partsToHistory(parts []*genai.Part) []any {
	var out []any
	for _, p := range parts {
		if p.Text != "" {
			out = append(out, map[string]string{"text": p.Text})
		} else if p.Thought != "" {
			out = append(out, map[string]any{"thought": p.Thought})
		} else if p.FunctionCall != nil {
			out = append(out, map[string]any{
				"functionCall": map[string]any{
					"name": p.FunctionCall.Name,
					"id":   p.FunctionCall.Id,
					"args": p.FunctionCall.Args,
				},
			})
		}
	}
	return out
}

func functionResponsesToHistory(parts []*genai.Part) []any {
	var out []any
	for _, p := range parts {
		if p.FunctionResponse != nil {
			out = append(out, map[string]any{
				"functionResponse": map[string]any{
					"name":     p.FunctionResponse.Name,
					"id":       p.FunctionResponse.Id,
					"response": p.FunctionResponse.Response,
				},
			})
		}
	}
	return out
}

func historyToContents(history []any) []*genai.Content {
	var contents []*genai.Content
	for _, h := range history {
		m, ok := h.(map[string]any)
		if !ok {
			continue
		}
		role, _ := m["role"].(string)
		parts, _ := m["parts"].([]any)
		if role == "" || len(parts) == 0 {
			continue
		}
		var genParts []*genai.Part
		for _, p := range parts {
			pm, ok := p.(map[string]any)
			if !ok {
				continue
			}
			if text, ok := pm["text"].(string); ok && text != "" {
				genParts = append(genParts, &genai.Part{Text: text})
			} else if thought, ok := pm["thought"].(string); ok && thought != "" {
				genParts = append(genParts, &genai.Part{Thought: thought})
			} else if fc, ok := pm["functionCall"].(map[string]any); ok {
				name, _ := fc["name"].(string)
				id, _ := fc["id"].(string)
				var args json.RawMessage
				if a, ok := fc["args"]; ok {
					args, _ = json.Marshal(a)
				}
				genParts = append(genParts, &genai.Part{
					FunctionCall: &genai.FunctionCall{Name: name, Id: id, Args: args},
				})
			} else if fr, ok := pm["functionResponse"].(map[string]any); ok {
				name, _ := fr["name"].(string)
				id, _ := fr["id"].(string)
				resp := fr["response"]
				genParts = append(genParts, &genai.Part{
					FunctionResponse: &genai.FunctionResponse{Name: name, Id: id, Response: resp},
				})
			}
		}
		if len(genParts) > 0 {
			contents = append(contents, &genai.Content{Role: role, Parts: genParts})
		}
	}
	return contents
}

func thoughtSummary(raw string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 120
	}
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	lines := strings.SplitN(trimmed, "\n", 2)
	first := strings.TrimSpace(lines[0])
	if len(first) > maxLen {
		return first[:maxLen] + "..."
	}
	return first
}

func thinkingStep(id, agentID, agentName, content, status, details string) map[string]any {
	m := map[string]any{
		"id":        id,
		"agentId":   agentID,
		"agentName": agentName,
		"content":   content,
		"status":   status,
		"timestamp": time.Now().UnixMilli(),
	}
	if details != "" {
		m["details"] = details
	}
	return m
}

func appendOrUpdate(steps []map[string]any, id string, step map[string]any) []map[string]any {
	for i := range steps {
		if sid, _ := steps[i]["id"].(string); sid == id {
			steps[i] = step
			return steps
		}
	}
	return append(steps, step)
}

func toolLabel(name string) string {
	defs := builtin.Definitions()
	for _, d := range defs {
		if d.Name == name && d.Description != "" {
			first := d.Description
			if idx := strings.IndexAny(first, "。；.;"); idx >= 0 {
				first = first[:idx]
			}
			first = strings.TrimSpace(first)
			if len(first) > 36 {
				first = first[:33] + "..."
			}
			return first
		}
	}
	return name
}

func sliceAny(in []any) []any {
	if in == nil {
		return nil
	}
	out := make([]any, len(in))
	copy(out, in)
	return out
}
