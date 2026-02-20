package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"agentic-demo/server/internal/prompts"
	"agentic-demo/server/internal/store"

	"google.golang.org/genai"
)

type ExecutorContext struct {
	Ctx         context.Context
	SessionID   string
	Store       *store.SessionStore
	TodoStore   *store.TodoStore
	GeminiClient *genai.Client
	OnProgress  func(string)
}

// ToolExecutor executes a builtin tool and returns the result.
type ToolExecutor func(ctx ExecutorContext, args json.RawMessage) (interface{}, error)

var executors = map[string]ToolExecutor{
	"get_current_date":      executeGetCurrentDate,
	"create_todo":           executeCreateTodo,
	"list_todos":            executeListTodos,
	"complete_todo":        executeCompleteTodo,
	"search_knowledge":      executeSearchKnowledge,
	"report_step_done":      executeReportStepDone,
	"write_file":            executeWriteFile,
	"generate_chart":        executeGenerateChart,
	"propose_plan":          executeProposePlan,
	"analyze_data":          executeAnalyzeData,
	"analyze_requirements":  executeAnalyzeRequirements,
	"self_reflect":          executeSelfReflect,
}

func GetExecutor(name string) (ToolExecutor, bool) {
	ex, ok := executors[name]
	return ex, ok
}

func executeGetCurrentDate(_ ExecutorContext, _ json.RawMessage) (interface{}, error) {
	return map[string]string{"iso": time.Now().UTC().Format(time.RFC3339)}, nil
}

func executeCreateTodo(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		Title    string `json:"title"`
		DueAt    string `json:"dueAt"`
		Priority string `json:"priority"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Title == "" {
		return nil, errMissingArg("title")
	}
	item, err := ctx.TodoStore.Add(inp.Title, inp.DueAt, inp.Priority)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"status": "CREATED",
		"id":     item.ID,
		"title":  item.Title,
	}, nil
}

func executeListTodos(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		IncludeCompleted bool `json:"includeCompleted"`
	}
	_ = json.Unmarshal(args, &inp)
	items, err := ctx.TodoStore.List(inp.IncludeCompleted)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"todos": items,
		"count": len(items),
	}, nil
}

func executeCompleteTodo(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.ID == "" {
		return nil, errMissingArg("id")
	}
	ok, err := ctx.TodoStore.Complete(inp.ID)
	if err != nil {
		return nil, err
	}
	if ok {
		return map[string]interface{}{"status": "COMPLETED", "id": inp.ID}, nil
	}
	return map[string]interface{}{"status": "NOT_FOUND", "id": inp.ID}, nil
}

func executeSearchKnowledge(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		Query string  `json:"query"`
		Limit float64 `json:"limit"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Query == "" {
		return nil, errMissingArg("query")
	}
	limit := 5
	if inp.Limit > 0 {
		limit = int(inp.Limit)
	}
	chunks, err := ctx.Store.GetKnowledgeChunks(ctx.SessionID)
	if err != nil || len(chunks) == 0 {
		return map[string]interface{}{
			"matches": []store.KnowledgeChunk{},
			"message": "知识库为空，请先在语义切片引擎中导入分块。",
		}, nil
	}
	keywords := regexp.MustCompile(`[^\p{Han}\p{Latin}\p{N}\s]+`).ReplaceAllString(inp.Query, " ")
	kwParts := strings.Fields(keywords)
	type scored struct {
		chunk store.KnowledgeChunk
		score int
	}
	var scoredList []scored
	qLower := strings.ToLower(inp.Query)
	for _, c := range chunks {
		text := strings.ToLower(c.Content + " " + c.Summary)
		score := 0
		if strings.Contains(text, qLower) {
			score += 10
		}
		for _, kw := range kwParts {
			if len(kw) > 1 && strings.Contains(text, strings.ToLower(kw)) {
				score += 2
			}
		}
		if score > 0 {
			scoredList = append(scoredList, scored{chunk: c, score: score})
		}
	}
	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].score < scoredList[j].score
	})
	for i, j := 0, len(scoredList)-1; i < j; i, j = i+1, j-1 {
		scoredList[i], scoredList[j] = scoredList[j], scoredList[i]
	}
	matches := make([]store.KnowledgeChunk, 0, limit)
	for i, s := range scoredList {
		if i >= limit {
			break
		}
		matches = append(matches, s.chunk)
	}
	return map[string]interface{}{
		"matches": matches,
		"total":   len(chunks),
	}, nil
}

func executeReportStepDone(_ ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		StepID string `json:"stepId"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	return map[string]interface{}{"status": "OK", "stepId": inp.StepID}, nil
}

func executeWriteFile(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		Path         string   `json:"path"`
		Content      string   `json:"content"`
		ContentChunks []string `json:"contentChunks"`
		Language     string   `json:"language"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Path == "" || inp.Language == "" {
		return nil, errMissingArg("path or language")
	}
	chunks := inp.ContentChunks
	if len(chunks) == 0 && inp.Content != "" {
		chunks = []string{inp.Content}
	}
	_ = ctx.Store.UpdateVFS(ctx.SessionID, inp.Path, "", inp.Language, true)
	var accumulated string
	for i, ch := range chunks {
		accumulated += ch
		_ = ctx.Store.UpdateVFS(ctx.SessionID, inp.Path, accumulated, inp.Language, true)
		if ctx.OnProgress != nil {
			ctx.OnProgress("Writing " + inp.Path + "...")
		}
		_ = i
	}
	_ = ctx.Store.UpdateVFS(ctx.SessionID, inp.Path, accumulated, inp.Language, false)
	return map[string]interface{}{"status": "SUCCESS", "path": inp.Path}, nil
}

func executeGenerateChart(_ ExecutorContext, args json.RawMessage) (interface{}, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(args, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func executeAnalyzeData(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	var inp struct {
		Data  string `json:"data"`
		Query string `json:"query"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Data == "" || inp.Query == "" {
		return nil, errMissingArg("data or query")
	}
	re := regexp.MustCompile(`\d+`)
	digits := re.FindAllString(inp.Data, -1)
	findings := map[string]interface{}{
		"summary": fmt.Sprintf("基于 %d 字符的数据，针对查询 %q 的分析结果", len(inp.Data), inp.Query),
		"insights": []string{
			fmt.Sprintf("数据规模：%d 字符", len(inp.Data)),
			fmt.Sprintf("查询焦点：%s", inp.Query),
			fmt.Sprintf("关键发现：数据中包含 %d 个数字", len(digits)),
		},
		"recommendations": []string{"建议进一步分析数据趋势", "考虑数据可视化展示"},
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	}
	return map[string]interface{}{"findings": findings, "status": "COMPLETED"}, nil
}

func executeAnalyzeRequirements(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	if ctx.GeminiClient == nil {
		return map[string]interface{}{"error": "Gemini client not configured"}, nil
	}
	var inp struct {
		Context string `json:"context"`
		Domain  string `json:"domain"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Context == "" || inp.Domain == "" {
		return nil, errMissingArg("context or domain")
	}
	prompt := prompts.AnalyzeRequirementsPrompt(inp.Context, inp.Domain, "智能编排")
	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{{Text: prompt}}},
	}
	iter := ctx.GeminiClient.Models.GenerateContentStream(ctx.Ctx, "gemini-2.0-flash", contents, nil)
	var fullText string
	for resp, err := range iter {
		if err != nil {
			return map[string]interface{}{"error": err.Error()}, nil
		}
		if resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0].Content != nil {
			for _, p := range resp.Candidates[0].Content.Parts {
				if p.Text != "" {
					fullText += p.Text
				}
			}
		}
	}
	return map[string]interface{}{"analysis": fullText, "status": "COMPLETED"}, nil
}

func executeSelfReflect(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	if ctx.GeminiClient == nil {
		return map[string]interface{}{"error": "Gemini client not configured"}, nil
	}
	var inp struct {
		OutputSummary string `json:"outputSummary"`
		UserRequest   string `json:"userRequest"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.OutputSummary == "" || inp.UserRequest == "" {
		return nil, errMissingArg("outputSummary or userRequest")
	}
	prompt := prompts.SelfReflectPrompt(inp.OutputSummary, inp.UserRequest)
	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{{Text: prompt}}},
	}
	cfg := &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
		ResponseSchema: &genai.Schema{
			Type: genai.TypeObject,
			Properties: map[string]*genai.Schema{
				"satisfied":    {Type: genai.TypeBoolean},
				"gaps":        {Type: genai.TypeArray},
				"improvements": {Type: genai.TypeArray},
			},
			Required: []string{"satisfied", "gaps", "improvements"},
		},
	}
	resp, err := ctx.GeminiClient.Models.GenerateContent(ctx.Ctx, "gemini-2.0-flash", contents, cfg)
	if err != nil {
		return map[string]interface{}{"error": err.Error()}, nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(resp.Text), &result); err != nil {
		return map[string]interface{}{"error": "invalid JSON"}, nil
	}
	return result, nil
}

func executeProposePlan(ctx ExecutorContext, args json.RawMessage) (interface{}, error) {
	if ctx.GeminiClient == nil {
		return map[string]interface{}{"error": "Gemini client not configured"}, nil
	}
	var inp struct {
		UserRequest string `json:"userRequest"`
		Industry    string `json:"industry"`
	}
	if err := json.Unmarshal(args, &inp); err != nil {
		return nil, err
	}
	if inp.Industry == "" {
		inp.Industry = "通用"
	}
	sysInst := prompts.ProposePlanSystem(inp.Industry)
	userText := prompts.ProposePlanUser(inp.UserRequest)
	cfg := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{Parts: []*genai.Part{{Text: sysInst}}},
	}
	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{{Text: userText}}},
	}
	iter := ctx.GeminiClient.Models.GenerateContentStream(ctx.Ctx, "gemini-2.0-flash", contents, cfg)
	var fullText string
	for resp, err := range iter {
		if err != nil {
			return map[string]interface{}{"error": err.Error()}, nil
		}
		if resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0].Content != nil {
			for _, p := range resp.Candidates[0].Content.Parts {
				if p.Text != "" {
					fullText += p.Text
				}
			}
		}
	}
	rawJSON := regexp.MustCompile("(?s)```json\\s*|\\s*```").ReplaceAllString(fullText, "")
	rawJSON = strings.TrimSpace(rawJSON)
	var parsed struct {
		Title string `json:"title"`
		Steps []struct {
			ID               string `json:"id"`
			Task             string `json:"task"`
			RequiresApproval bool   `json:"requiresApproval"`
			Parallel         bool   `json:"parallel"`
		} `json:"steps"`
	}
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return map[string]interface{}{"error": "子代理未能生成有效计划", "raw": fullText}, nil
	}
	steps := make([]map[string]interface{}, 0, len(parsed.Steps))
	for i, s := range parsed.Steps {
		id := s.ID
		if id == "" {
			id = fmt.Sprintf("step-%d", i+1)
		}
		steps = append(steps, map[string]interface{}{
			"id":               id,
			"task":             s.Task,
			"requiresApproval": s.RequiresApproval,
			"parallel":         s.Parallel,
			"status":          "pending",
			"approved":         true,
			"isAutoApproved":   !s.RequiresApproval,
		})
	}
	plan := map[string]interface{}{
		"title":      parsed.Title,
		"steps":      steps,
		"isApproved": false,
	}
	return map[string]interface{}{"plan": plan, "status": "PLAN_PROPOSED"}, nil
}

type errMissingArg string

func (e errMissingArg) Error() string {
	return "missing required argument: " + string(e)
}

// Definitions returns genai FunctionDeclaration for all builtin tools.
func Definitions() []*genai.FunctionDeclaration {
	return []*genai.FunctionDeclaration{
		{
			Name:        "get_current_date",
			Description: "获取当前系统时间（ISO 8601）。用于需要时间上下文的任务。",
			Parameters:  &genai.Schema{Type: genai.TypeObject, Properties: map[string]*genai.Schema{}},
		},
		{
			Name:        "create_todo",
			Description: "创建待办事项。参数：title、dueAt（可选，ISO 日期）、priority（可选：low/medium/high）。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"title":    {Type: genai.TypeString, Description: ptr("待办标题")},
					"dueAt":    {Type: genai.TypeString, Description: ptr("截止时间（ISO 8601）")},
					"priority": {Type: genai.TypeString, Description: ptr("优先级"), Enum: []string{"low", "medium", "high"}},
				},
				Required: []string{"title"},
			},
		},
		{
			Name:        "list_todos",
			Description: "列出待办事项。includeCompleted 为 true 时包含已完成。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"includeCompleted": {Type: genai.TypeBoolean, Description: ptr("是否包含已完成")},
				},
			},
		},
		{
			Name:        "complete_todo",
			Description: "将指定 ID 的待办标为已完成。",
			Parameters: &genai.Schema{
				Type:       genai.TypeObject,
				Properties: map[string]*genai.Schema{"id": {Type: genai.TypeString, Description: ptr("待办 ID")}},
				Required:   []string{"id"},
			},
		},
		{
			Name:        "search_knowledge",
			Description: "从当前会话知识库检索相关分块。用于文档、长文本相关问题时获取上下文。若知识库为空则返回空结果。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"query": {Type: genai.TypeString, Description: ptr("检索关键词或问题摘要")},
					"limit": {Type: genai.TypeNumber, Description: ptr("返回最大条数，默认 5")},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "report_step_done",
			Description: "计划执行时，每完成一个步骤后调用，传入该步骤的 id（如 step-1）。用于更新计划进度。",
			Parameters: &genai.Schema{
				Type:       genai.TypeObject,
				Properties: map[string]*genai.Schema{"stepId": {Type: genai.TypeString, Description: ptr("计划步骤 id")}},
				Required:   []string{"stepId"},
			},
		},
		{
			Name:        "write_file",
			Description: "写入虚拟文件系统(VFS)。支持流式内容。多步骤任务须在 propose_plan 获批准后再调用；单步简单任务可直接调用。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"path":          {Type: genai.TypeString, Description: ptr("文件路径")},
					"content":       {Type: genai.TypeString, Description: ptr("文件内容")},
					"contentChunks": {Type: genai.TypeArray, Description: ptr("文件内容块数组（用于流式写入）")},
					"language":      {Type: genai.TypeString, Description: ptr("编程语言或格式")},
				},
				Required: []string{"path", "language"},
			},
		},
		{
			Name:        "generate_chart",
			Description: "生成数据可视化图表。支持柱状图(bar)、饼图(pie)、折线图(line)。需提供 labels 与 datasets。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"type":     {Type: genai.TypeString, Enum: []string{"bar", "pie", "line"}},
					"title":    {Type: genai.TypeString},
					"labels":   {Type: genai.TypeArray},
					"datasets": {Type: genai.TypeArray},
				},
				Required: []string{"type", "title", "labels", "datasets"},
			},
		},
		{
			Name:        "propose_plan",
			Description: "当需求为多步骤时调用。传入用户请求摘要，由子代理生成执行计划并等待用户批准。单步请求勿调用。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"userRequest": {Type: genai.TypeString, Description: ptr("用户请求或需求摘要")},
					"industry":    {Type: genai.TypeString, Description: ptr("行业语境（如通用政企、法律合规）")},
				},
				Required: []string{"userRequest"},
			},
		},
		{
			Name:        "analyze_data",
			Description: "分析数据并回答查询。接受数据字符串和查询问题，返回包含发现的 JSON 对象。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"data":  {Type: genai.TypeString, Description: ptr("待分析的数据")},
					"query": {Type: genai.TypeString, Description: ptr("查询问题或分析目标")},
				},
				Required: []string{"data", "query"},
			},
		},
		{
			Name:        "analyze_requirements",
			Description: "对复杂需求做精简分析：意图、实现路径、是否需 plan。输出流式返回。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"context": {Type: genai.TypeString, Description: ptr("待分析的完整需求或业务描述")},
					"domain":  {Type: genai.TypeString, Description: ptr("业务领域（如：法律合规、金融财务、技术研发）")},
				},
				Required: []string{"context", "domain"},
			},
		},
		{
			Name:        "self_reflect",
			Description: "对当前输出做自检，返回供 Agent 自行改进的要点。写操作或多步骤任务执行后可调用。",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"outputSummary": {Type: genai.TypeString, Description: ptr("当前输出或执行结果的简要摘要")},
					"userRequest":   {Type: genai.TypeString, Description: ptr("用户原始需求或目标")},
				},
				Required: []string{"outputSummary", "userRequest"},
			},
		},
	}
}

func ptr(s string) *string {
	return &s
}
