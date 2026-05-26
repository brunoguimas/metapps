package ai

import "embed"

//go:embed schemas/*.json templates/*.txt
var FS embed.FS
