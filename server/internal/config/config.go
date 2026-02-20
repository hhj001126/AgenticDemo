package config

import (
	"os"
	"path/filepath"
)

var (
	Port         string
	GeminiAPIKey string
	DataDir      string
	SessionsDir  string
)

func Load() {
	Port = getEnv("PORT", "8080")
	GeminiAPIKey = os.Getenv("GEMINI_API_KEY")
	if GeminiAPIKey == "" {
		GeminiAPIKey = os.Getenv("GOOGLE_API_KEY")
	}
	base, _ := os.Getwd()
	if base == "" {
		base = "."
	}
	DataDir = getEnv("DATA_DIR", filepath.Join(base, ".agent"))
	SessionsDir = filepath.Join(DataDir, "sessions")
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
