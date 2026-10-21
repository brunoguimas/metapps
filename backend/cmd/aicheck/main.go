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
	ctx := context.Background()
	req := ai.Request{Prompt: "Responda apenas com JSON: {\"ok\":true}", Format: ai.OutputFormatJSON}

	fmt.Println("--- Gemini ---")
	gc, err := ai.NewGeminiClient(ctx, *cfg)
	if err != nil {
		fmt.Println("client err:", err)
	} else {
		resp, err := gc.Generate(ctx, req)
		fmt.Println("resp:", resp)
		fmt.Println("err:", err)
	}

	fmt.Println("--- Groq ---")
	qc := ai.NewGroqClient(*cfg)
	resp2, err2 := qc.Generate(ctx, req)
	fmt.Println("resp:", resp2)
	fmt.Println("err:", err2)

	os.Exit(0)
}
