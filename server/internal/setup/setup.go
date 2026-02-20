package setup

import (
	"agentic-demo/server/internal/registry"
	"agentic-demo/server/internal/registry/builtin"
)

// RegisterBuiltinTools 将 builtin 工具注册到 registry，打破 builtin -> registry 的 import cycle
func RegisterBuiltinTools(reg *registry.Registry) {
	for _, def := range builtin.Definitions() {
		blocking := def.Name == "propose_plan" || def.Name == "analyze_requirements"
		reg.Register(def.Name, def, blocking)
	}
}
