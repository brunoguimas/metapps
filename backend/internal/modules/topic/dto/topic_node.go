package dto

type TopicNode struct {
	NameID          string  `json:"id"`
	ParentID        *string `json:"parent_id"`
	Title           string  `json:"title"`
	RequiredMastery float64 `json:"required_mastery"`
	Description     string  `json:"description"`
	Weight          float64 `json:"weight"`
	OrderIndex      int32   `json:"order_index"`
}

type TopicEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type AIRoadmapResponse struct {
	Nodes []TopicNode `json:"nodes"`
	Edges []TopicEdge `json:"edges"`
}
