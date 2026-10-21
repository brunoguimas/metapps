package health

type StatusService struct {
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Provider  string `json:"provider,omitempty"`
	Error     string `json:"error,omitempty"`
}
