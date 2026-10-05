package main

import (
	"context"
	"fmt"
	"os"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
)

func main() {
	cfg := config.Load()

	fmt.Println("--- Gemini ---")
	gc, err := ai.NewGeminiClient(context.Background(), *cfg)
	if err != nil {
		fmt.Println("client err:", err)
	} else {
		resp, err := gc.Generate(context.Background(), "Responda apenas com JSON: {\"ok\":true}")
		fmt.Println("resp:", resp)
		fmt.Println("err:", err)
	}

	fmt.Println("--- Groq ---")
	qc, raw := ai.NewGroqClient()
	_ = raw
	resp2, err2 := qc.Generate("Responda apenas com JSON: {\"ok\":true}")
	fmt.Println("resp:", resp2)
	fmt.Println("err:", err2)

	os.Exit(0)
}