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

type TopicService interface {
	GenerateRoadmap(c context.Context, g *goal.Goal) (*Roadmap, error)
	GetRoadmap(c context.Context, goalID uuid.UUID) (*Roadmap, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
}

type topicService struct {
	repo         TopicRepository
	deps         topic_dependency.TopicDependencyService
	ai           ai.Client
	cfg          *config.Config
	progressRepo TopicProgressRepository
}


func NewTopicService(r TopicRepository, d topic_dependency.TopicDependencyService, a ai.Client, c *config.Config, pr TopicProgressRepository) TopicService {
	return topicService{
		repo:         r,
		deps:         d,
		ai:           a,
		cfg:          c,
		progressRepo: pr,
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

	// Try up to 3 times with improving prompts
	var lastError error
	for attempt := 0; attempt < 3; attempt++ {
		prompt, err := ai.RenderPrompt("generate_roadmap.txt", data)
		if err != nil {
			return nil, err
		}

		// On retry attempts, add feedback about what went wrong
		if attempt > 0 && lastError != nil {
			prompt = enhanceRoadmapPromptWithFeedback(prompt, lastError)
		}

		roadmapJSON, err := s.ai.Generate(c, prompt)
		if err != nil {
			lastError = err
			continue // Try again
		}

		r, err := parseRoadmapJSON(string(roadmapJSON))
		if err != nil {
			lastError = err
			continue // Try again with enhanced prompt
		}

		// Success! Process the roadmap
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
				lastError = apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "subtopic refers to a root topic which doesn't exists", nil)
				continue // Try again
			}

			topic := &Topic{
				GoalID: g.ID,
				ParentTopicID: uuid.NullUUID{
					Valid: true,
					// puxa o id do pai do mapa
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

		// If we had any errors in processing subtopics, retry
		if lastError != nil {
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
				break // Try again
			}

			to, ok := topics[edge.To]
			if !ok {
				lastError = apperrors.NewAppError(
					apperrors.ErrInvalidAIResponse,
					fmt.Sprintf("dependency source '%s' not found", edge.From),
					nil,
				)
				break // Try again
			}

			d := &topic_dependency.TopicDependency{
				TopicID:          to.ID,
				DependsOnTopicID: from.ID,
			}

			dependency, err := s.deps.Create(c, d)
			if err != nil {
				lastError = err
				break // Try again
			}

			roadmap.Dependencies = append(roadmap.Dependencies, dependency)
		}

		// If we succeeded in processing all edges, return the roadmap
		if lastError == nil {
			return &roadmap, nil
		}
		// Otherwise loop will continue for another attempt
	}

	// If we got here, all attempts failed
	return nil, lastError
}

// enhanceRoadmapPromptWithFeedback adds specific guidance based on the previous error
func enhanceRoadmapPromptWithFeedback(originalPrompt string, prevErr error) string {
	feedback := "\n\n## FEEDBACK DA TENTATIVA ANTERIOR\n"
	feedback += "Na tentativa anterior, seu response foi inválido pelo seguinte motivo:\n"
	feedback += "- " + strings.ReplaceAll(prevErr.Error(), "\n", "\n- ") + "\n"
	feedback += "\nPor favor, corrija estes problemas específicos e tente novamente, seguindo TODAS as regras do prompt original."
	feedback += "\nLembre-se: RETORNE APENAS JSON VÁLIDO, nenhum texto adicional."

	return originalPrompt + feedback
}

func (s topicService) Get(c context.Context, topicID uuid.UUID) (*Topic, error) {
	return s.repo.Get(c, topicID)
}

func (s topicService) GetRoadmap(c context.Context, goalID uuid.UUID) (*Roadmap, error) {
	topics, err := s.repo.GetByGoalID(c, goalID)
	if err != nil {
		return nil, err
	}

	topicIDs := make([]uuid.UUID, 0, len(topics))
	for _, topic := range topics {
		topicIDs = append(topicIDs, topic.ID)
	}

	dependencies, err := s.deps.GetByTopicIDs(c, topicIDs)
	if err != nil {
		return nil, err
	}

	return &Roadmap{Topics: topics, Dependencies: dependencies}, nil
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

	return &roadmap, nil
}
