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
	GenerateRoadmap(c context.Context, userID uuid.UUID, g *goal.Goal) (*Roadmap, error)
	GetRoadmap(c context.Context, userID, goalID uuid.UUID) (*Roadmap, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
	RecordAttempt(c context.Context, userID, topicID uuid.UUID, score float64) (*TopicProgress, error)
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

func (s *topicService) GenerateRoadmap(c context.Context, userID uuid.UUID, g *goal.Goal) (*Roadmap, error) {
	// Se o goal já tem um roadmap, não duplica: devolve o existente.
	// Isso preserva os IDs dos tópicos (e o progresso/tarefas vinculados a eles).
	existing, err := s.repo.GetByGoalID(c, g.ID)
	if err != nil {
		return nil, err
	}
	if len(existing) > 0 {
		return s.GetRoadmap(c, userID, g.ID)
	}

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

	// lastErr é o erro devolvido ao cliente; lastResponseErr só alimenta o
	// prompt de feedback. São separados de propósito: um 503 do provedor não
	// é um defeito da resposta, então não faz sentido pedirmos para o modelo
	// "corrigir" um erro de rede.
	var lastErr, lastResponseErr error
	for attempt := 0; attempt < ai.MaxAttempts; attempt++ {
		prompt, err := ai.RenderPrompt("generate_roadmap.txt", data)
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't render prompt", err)
		}

		if attempt > 0 && lastResponseErr != nil {
			prompt = enhanceRoadmapPromptWithFeedback(prompt, lastResponseErr)
		}

		roadmapJSON, err := s.ai.Generate(c, prompt)
		if err != nil {
			lastErr = err

			if !ai.IsUpstreamUnavailable(err) {
				continue
			}
			if attempt == ai.MaxAttempts-1 {
				break
			}
			if waitErr := ai.Backoff(c, attempt); waitErr != nil {
				return nil, apperrors.NewAppError(
					apperrors.ErrUpstreamUnavailable,
					"ai provider is temporarily unavailable, please try again",
					err,
				)
			}
			continue
		}

		r, err := parseRoadmapJSON(string(roadmapJSON))
		if err != nil {
			lastErr, lastResponseErr = err, err
			continue
		}

		// A resposta é parseável, então zera o estado de validação: o erro da
		// tentativa anterior não pode contaminar o laço de tópicos abaixo,
		// sob pena de esta tentativa cair no `continue` sem nunca validar.
		lastErr, lastResponseErr = nil, nil

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
				lastResponseErr = apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "subtopic refers to a root topic which doesn't exists", nil)
				lastErr = lastResponseErr
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

		if lastResponseErr != nil {
			_ = s.repo.DeleteByGoalID(c, g.ID)
			continue
		}

		for _, edge := range r.Edges {
			from, ok := topics[edge.From]
			if !ok {
				lastResponseErr = apperrors.NewAppError(
					apperrors.ErrInvalidAIResponse,
					fmt.Sprintf("dependency source '%s' not found", edge.From),
					nil,
				)
				lastErr = lastResponseErr
				break
			}

			to, ok := topics[edge.To]
			if !ok {
				lastResponseErr = apperrors.NewAppError(
					apperrors.ErrInvalidAIResponse,
					fmt.Sprintf("dependency target '%s' not found", edge.To),
					nil,
				)
				lastErr = lastResponseErr
				break
			}

			d := &topic_dependency.TopicDependency{
				TopicID:          to.ID,
				DependsOnTopicID: from.ID,
			}

			dependency, err := s.deps.Create(c, d)
			if err != nil {
				lastErr, lastResponseErr = err, err
				break
			}

			roadmap.Dependencies = append(roadmap.Dependencies, dependency)
		}

		if lastResponseErr != nil {
			_ = s.repo.DeleteByGoalID(c, g.ID)
			continue
		}

		roadmap.Progress = []*TopicProgress{}

		return &roadmap, nil
	}

	return nil, lastErr
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

func (s topicService) GetRoadmap(c context.Context, userID, goalID uuid.UUID) (*Roadmap, error) {
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

	progress, err := s.progressRepo.ListByUserAndGoal(c, userID, goalID)
	if err != nil {
		return nil, err
	}

	return &Roadmap{Topics: topics, Dependencies: dependencies, Progress: progress}, nil
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
