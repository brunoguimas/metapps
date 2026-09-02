package topic

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	GenerateRoadmap(c context.Context, g *goal.Goal) (*Roadmap, error)
	GetRoadmap(c context.Context, goalID uuid.UUID) (*Roadmap, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
}

type topicService struct {
	repo         Repository
	deps         topic_dependency.Service
	ai           ai.Client
	cfg          *config.Config
	progressRepo ProgressRepository
}

func NewService(r Repository, d topic_dependency.Service, a ai.Client, c *config.Config, pr ProgressRepository) Service {
	return &topicService{
		repo:         r,
		deps:         d,
		ai:           a,
		cfg:          c,
		progressRepo: pr,
	}
}

func (s *topicService) GenerateRoadmap(c context.Context, g *goal.Goal) (*Roadmap, error) {
	b, err := ai.FS.ReadFile("schemas/roadmap.schema.json")
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't read roadmap schema", err)
	}
	data := struct {
		GoalTitle     string
		RoadmapSchema string
	}{
		GoalTitle:     g.Title,
		RoadmapSchema: string(b),
	}

	var lastError error
	for attempt := 0; attempt < 3; attempt++ {
		prompt, err := ai.RenderPrompt("generate_roadmap.txt", data)
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't render prompt", err)
		}

		if attempt > 0 && lastError != nil {
			prompt = enhanceRoadmapPromptWithFeedback(prompt, lastError)
		}

		roadmapJSON, err := s.ai.Generate(c, prompt)
		if err != nil {
			lastError = err
			continue
		}

		r, err := parseRoadmapJSON(string(roadmapJSON))
		if err != nil {
			lastError = err
			continue
		}

		var roadmap Roadmap
		topics := make(map[string]*Topic)

		for _, node := range r.Nodes {
			if node.ParentID != nil {
				continue
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

		for _, node := range r.Nodes {
			if node.ParentID == nil {
				continue
			}

			if topics[*node.ParentID] == nil {
				lastError = apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "subtopic refers to a root topic which doesn't exists", nil)
				continue
			}

			topic := &Topic{
				GoalID: g.ID,
				ParentTopicID: uuid.NullUUID{
					Valid: true,
					UUID:  topics[*node.ParentID].ID,
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

		if lastError != nil {
			_ = s.repo.DeleteByGoalID(c, g.ID)
			continue
		}

		for _, edge := range r.Edges {
			from, ok := topics[edge.From]
			if !ok {
				lastError = apperrors.NewAppError(
					apperrors.ErrInvalidAIResponse,
					fmt.Sprintf("dependency source '%s' not found", edge.From),
					nil,
				)
				break
			}

			to, ok := topics[edge.To]
			if !ok {
				lastError = apperrors.NewAppError(
					apperrors.ErrInvalidAIResponse,
					fmt.Sprintf("dependency source '%s' not found", edge.From),
					nil,
				)
				break
			}

			d := &topic_dependency.TopicDependency{
				TopicID:          to.ID,
				DependsOnTopicID: from.ID,
			}

			dependency, err := s.deps.Create(c, d)
			if err != nil {
				lastError = err
				break
			}

			roadmap.Dependencies = append(roadmap.Dependencies, dependency)
		}

		if lastError != nil {
			_ = s.repo.DeleteByGoalID(c, g.ID)
			continue
		}

		return &roadmap, nil
	}

	return nil, lastError
}

func enhanceRoadmapPromptWithFeedback(originalPrompt string, prevErr error) string {
	feedback := "\n\n## FEEDBACK DA TENTATIVA ANTERIOR\n"
	feedback += "Na tentativa anterior, seu response foi inválido pelo seguinte motivo:\n"
	feedback += "- " + strings.ReplaceAll(prevErr.Error(), "\n", "\n- ") + "\n"
	feedback += "\nPor favor, corrija estes problemas específicos e tente novamente, seguindo TODAS as regras do prompt original."
	feedback += "\nLembre-se: RETORNE APENAS JSON VÁLIDO, nenhum texto adicional."

	return originalPrompt + feedback
}

func (s *topicService) Get(c context.Context, topicID uuid.UUID) (*Topic, error) {
	t, err := s.repo.Get(c, topicID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic", err)
	}
	return t, nil
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

func (s *topicService) GetRoadmap(c context.Context, goalID uuid.UUID) (*Roadmap, error) {
	topics, err := s.repo.GetByGoalID(c, goalID)
	if err != nil {
		return nil, err
	}

	var topicIDs []uuid.UUID
	for _, topic := range topics {
		topicIDs = append(topicIDs, topic.ID)
	}

	dependencies, err := s.deps.GetByTopicIDs(c, topicIDs)
	if err != nil {
		return nil, err
	}

	roadmap := &Roadmap{
		Topics:       topics,
		Dependencies: dependencies,
	}

	return roadmap, nil
}
