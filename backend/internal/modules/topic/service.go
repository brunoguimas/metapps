package topic

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TopicService interface {
	GenerateRoadmap(c context.Context, g *goal.Goal) (*Roadmap, error)
	GetRoadmap(c context.Context, goalID uuid.UUIDs) (*Roadmap, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
}

type topicService struct {
	repo TopicRepository
	deps topic_dependency.TopicDependencyService
	ai   ai.Client
	cfg  *config.Config
}

func NewTopicService(r TopicRepository, d topic_dependency.TopicDependencyService, a ai.Client, c *config.Config) TopicService {
	return topicService{
		repo: r,
		deps: d,
		ai:   a,
		cfg:  c,
	}
}

func (s topicService) GenerateRoadmap(c context.Context, g *goal.Goal) (*Roadmap, error) {
	b, err := ai.FS.ReadFile("schemas/roadmap.schema.json")
	if err != nil {
		return nil, err
	}
	data := struct {
		GoalTitle     string
		RoadmapSchema string
	}{
		GoalTitle:     g.Title,
		RoadmapSchema: string(b),
	}

	prompt, err := ai.RenderPrompt("generate_roadmap.txt", data)
	if err != nil {
		return nil, err
	}

	roadmapJSON, err := s.ai.Generate(prompt)
	os.WriteFile("file.txt", []byte(roadmapJSON), os.ModeAppend)

	r, err := parseRoadmapJSON(string(roadmapJSON))
	if err != nil {
		return nil, err
	}

	var roadmap Roadmap
	topics := make(map[string]*Topic)

	// passa por todos os nodes, se for root (tópico) guarda no banco
	for _, node := range r.Nodes {
		if node.ParentID != nil {
			continue // temos que guardar os pais no banco primeiro, depois os subtópicos referenciando esses tópicos
		}

		topic := &Topic{
			GoalID:          g.ID,
			ParentTopicID:   uuid.NullUUID{Valid: false},
			Title:           node.Title,
			Description:     node.Description,
			RequiredMastery: node.RequiredMastery,
			Weight:          node.Weight,
			OrderIndex:      node.OrderIndex,
		}

		t, err := s.repo.Create(c, topic)
		if err != nil {
			return nil, err
		}
		topics[node.NameID] = t
		roadmap.Topics = append(roadmap.Topics, t)
	}

	// guarda cada subtópico no banco
	for _, node := range r.Nodes {
		if node.ParentID == nil {
			continue
		}

		if topics[*node.ParentID] == nil {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "subtopic refers to a root topic which doesn't exists", nil)
		}

		topic := &Topic{
			GoalID: g.ID,
			ParentTopicID: uuid.NullUUID{
				Valid: true,
				// puxa o id do pai do map
				UUID: topics[*node.ParentID].ID,
			},
			Title:           node.Title,
			Description:     node.Description,
			RequiredMastery: node.RequiredMastery,
			Weight:          node.Weight,
			OrderIndex:      node.OrderIndex,
		}

		t, err := s.repo.Create(c, topic)
		if err != nil {
			return nil, err
		}

		topics[node.NameID] = t
		roadmap.Topics = append(roadmap.Topics, t)
	}

	for _, edge := range r.Edges {
		from, ok := topics[edge.From]
		if !ok {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("dependency source '%s' not found", edge.From),
				nil,
			)
		}

		to, ok := topics[edge.To]
		if !ok {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("dependency source '%s' not found", edge.From),
				nil,
			)
		}

		d := &topic_dependency.TopicDependency{
			TopicID:          to.ID,
			DependsOnTopicID: from.ID,
		}

		dependency, err := s.deps.Create(c, d)
		if err != nil {
			return nil, err
		}

		roadmap.Dependencies = append(roadmap.Dependencies, dependency)
	}

	return &roadmap, nil
}

func (s topicService) Get(c context.Context, topicID uuid.UUID) (*Topic, error) {
	return s.repo.Get(c, topicID)
}

func parseRoadmapJSON(roadmapStr string) (*dto.AIRoadmapResponse, error) {
	cleaned := strings.TrimSpace(roadmapStr)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var roadmap dto.AIRoadmapResponse
	err := json.Unmarshal([]byte(cleaned), &roadmap)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, fmt.Sprintf("invalid json: %s", err.Error()), err)
	}

	validNodes := make([]dto.TopicNode, 0, len(roadmap.Nodes))
	for i := range roadmap.Nodes {
		node := &roadmap.Nodes[i]
		node.Title = strings.TrimSpace(node.Title)
		node.NameID = strings.TrimSpace(node.NameID)
		node.Description = strings.TrimSpace(node.Description)

		if node.Title == "" {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("topic node at index %d has an empty title", i),
				nil,
			)
		}
		if node.NameID == "" {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("topic node at index %d has an empty id", i),
				nil,
			)
		}
		validNodes = append(validNodes, *node)
	}
	roadmap.Nodes = validNodes

	return &roadmap, nil
}

func (s topicService) GetRoadmap(c context.Context, goalID uuid.UUIDs) (*Roadmap, error) {
	return nil, nil
}
