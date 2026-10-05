package flashcard

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

const (
	defaultCardsPerSession = 6
	maxCardsPerSession     = 20
	minCardsPerSession     = 2
)

// AccessChecker verifies whether a user may access content related to a topic
// (either because they own it, or because they belong to a classroom that
// shares it).
type AccessChecker interface {
	EnsureTopicAccess(ctx context.Context, userID, topicID uuid.UUID) error
}

type Service interface {
	Generate(c context.Context, userID, topicID uuid.UUID) ([]*Flashcard, error)
	Create(c context.Context, userID uuid.UUID, input *CreateManualInput) (*Flashcard, error)
	ListByTopic(c context.Context, userID, topicID uuid.UUID) ([]*DeckCard, error)
	ListDue(c context.Context, userID uuid.UUID) ([]*DeckCard, error)
	ListReview(c context.Context, userID uuid.UUID) ([]*DeckCard, error)
	Review(c context.Context, userID, id uuid.UUID, input *ReviewInput) (*DeckCard, error)
	Delete(c context.Context, userID, id uuid.UUID) error
}

type flashcardService struct {
	repo         Repository
	topicRepo    topic.Repository
	topics       topic.Service
	progressRepo topic.ProgressRepository
	goals        goal.Service
	access       AccessChecker
	ai           ai.Client
	cfg          *config.Config
}

func NewService(r Repository, tr topic.Repository, t topic.Service, pr topic.ProgressRepository, g goal.Service, access AccessChecker, a ai.Client, c *config.Config) Service {
	return &flashcardService{
		repo:         r,
		topicRepo:    tr,
		topics:       t,
		progressRepo: pr,
		goals:        g,
		access:       access,
		ai:           a,
		cfg:          c,
	}
}

func (s *flashcardService) Create(c context.Context, userID uuid.UUID, input *CreateManualInput) (*Flashcard, error) {
	if strings.TrimSpace(input.Front) == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "front cannot be empty", nil)
	}
	if strings.TrimSpace(input.Back) == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "back cannot be empty", nil)
	}

	if err := s.access.EnsureTopicAccess(c, userID, input.TopicID); err != nil {
		return nil, err
	}

	creator, err := s.contentOwner(c, userID, input.TopicID)
	if err != nil {
		return nil, err
	}

	card := &Flashcard{
		UserID:  creator,
		TopicID: input.TopicID,
		Source:  SourceManual,
		Front:   strings.TrimSpace(input.Front),
		Back:    strings.TrimSpace(input.Back),
	}
	return s.repo.Create(c, card)
}

func (s *flashcardService) Generate(c context.Context, userID, topicID uuid.UUID) ([]*Flashcard, error) {
	t, err := s.topics.Get(c, topicID)
	if err != nil {
		return nil, err
	}

	goalObj, err := s.goals.Get(c, userID, t.GoalID)
	if err != nil {
		return nil, err
	}

	cardCount := cardsPerSession(goalObj.Settings.Time)
	schema, err := ai.FS.ReadFile("schemas/flashcard.schema.json")
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't read flashcard schema", err)
	}

	data := struct {
		TopicTitle       string
		TopicDescription string
		GoalTitle        string
		GoalMotivation   string
		LearningStyle    string
		CardCount        int
		Schema           string
	}{
		TopicTitle:       t.Title,
		TopicDescription: t.Description,
		GoalTitle:        goalObj.Title,
		GoalMotivation:   goalObj.Settings.Motivation,
		LearningStyle:    goalObj.Settings.LearningStyle,
		CardCount:        cardCount,
		Schema:           string(schema),
	}

	// lastErr é o erro devolvido ao cliente; lastResponseErr só alimenta o
	// prompt de feedback. Um 503 do provedor não é defeito da resposta, então
	// não adianta pedir para o modelo "corrigir" um erro de rede.
	var lastErr, lastResponseErr error
	for attempt := 0; attempt < ai.MaxAttempts; attempt++ {
		prompt, err := ai.RenderPrompt("generate_cards.txt", data)
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't render prompt", err)
		}
		if attempt > 0 && lastResponseErr != nil {
			prompt = enhancePromptWithFeedback(prompt, lastResponseErr)
		}

		raw, err := s.ai.Generate(c, prompt)
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

		cards, err := parseGeneratedCards(raw)
		if err != nil {
			lastErr, lastResponseErr = err, err
			continue
		}
		if len(cards) == 0 {
			lastErr = apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "AI returned no flashcards", nil)
			lastResponseErr = lastErr
			continue
		}

		return s.persistGenerated(c, userID, topicID, cards)
	}

	return nil, lastErr
}

func (s *flashcardService) persistGenerated(c context.Context, userID, topicID uuid.UUID, cards []generatedCard) ([]*Flashcard, error) {
	creator, err := s.contentOwner(c, userID, topicID)
	if err != nil {
		return nil, err
	}

	created := make([]*Flashcard, 0, len(cards))
	for _, gc := range cards {
		card := &Flashcard{
			UserID:  creator,
			TopicID: topicID,
			Source:  SourceAI,
			Front:   gc.Front,
			Back:    gc.Back,
		}
		res, err := s.repo.Create(c, card)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok && appErr.Code() == apperrors.ErrFlashcardDuplicate {
				continue
			}
			return nil, err
		}
		created = append(created, res)
	}
	if len(created) == 0 {
		return nil, apperrors.NewAppError(apperrors.ErrFlashcardDuplicate, "all generated cards already exist for this topic", nil)
	}
	return created, nil
}

func (s *flashcardService) ListByTopic(c context.Context, userID, topicID uuid.UUID) ([]*DeckCard, error) {
	if err := s.access.EnsureTopicAccess(c, userID, topicID); err != nil {
		return nil, err
	}
	return s.repo.ListByUserAndTopic(c, userID, topicID)
}

func (s *flashcardService) ListDue(c context.Context, userID uuid.UUID) ([]*DeckCard, error) {
	return s.repo.ListDueByUser(c, userID, maxCardsPerSession)
}

func (s *flashcardService) ListReview(c context.Context, userID uuid.UUID) ([]*DeckCard, error) {
	goals, err := s.goals.List(c, userID)
	if err != nil {
		return nil, err
	}

	topicIDs := make([]uuid.UUID, 0)
	limit := int32(maxCardsPerSession)
	for _, g := range goals {
		ts, err := s.topicRepo.GetByGoalID(c, g.ID)
		if err != nil {
			return nil, err
		}
		for _, t := range ts {
			topicIDs = append(topicIDs, t.ID)
		}

		n := cardsPerSession(g.Settings.Time)
		if n < int(limit) {
			limit = int32(n)
		}
	}
	if len(topicIDs) == 0 {
		return []*DeckCard{}, nil
	}

	return s.repo.ListDueByTopicIDs(c, userID, topicIDs, limit)
}

func (s *flashcardService) Review(c context.Context, userID, id uuid.UUID, input *ReviewInput) (*DeckCard, error) {
	card, err := s.repo.GetByID(c, id)
	if err != nil {
		return nil, err
	}
	if err := s.access.EnsureTopicAccess(c, userID, card.TopicID); err != nil {
		return nil, err
	}

	progress, err := s.repo.GetProgress(c, userID, card.ID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok && appErr.Code() == apperrors.ErrFlashcardNotFound {
			progress = &FlashcardProgress{
				UserID:       userID,
				FlashcardID:  card.ID,
				EaseFactor:   2.5,
				IntervalDays: 0,
				Repetitions:  0,
				NextReviewAt: time.Now(),
			}
			progress, err = s.repo.UpsertProgress(c, progress)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	newEase, newInterval, newReps, err := sm2(input.Quality, progress.EaseFactor, progress.Repetitions, progress.IntervalDays)
	if err != nil {
		return nil, err
	}

	progress.EaseFactor = newEase
	progress.IntervalDays = newInterval
	progress.Repetitions = newReps
	progress.NextReviewAt = time.Now().AddDate(0, 0, int(newInterval))

	if _, err := s.repo.UpdateProgress(c, progress); err != nil {
		return nil, err
	}

	if err := s.updateTopicProgress(c, userID, card.TopicID, input.Quality); err != nil {
		return nil, err
	}

	return &DeckCard{
		FlashcardID: card.ID,
		TopicID:     card.TopicID,
		Source:      card.Source,
		Front:       card.Front,
		Back:        card.Back,
		Progress:    progress,
	}, nil
}

func (s *flashcardService) Delete(c context.Context, userID, id uuid.UUID) error {
	card, err := s.repo.GetByID(c, id)
	if err != nil {
		return err
	}
	if err := s.access.EnsureTopicAccess(c, userID, card.TopicID); err != nil {
		return err
	}
	return s.repo.Delete(c, id)
}

// contentOwner returns the user that owns the content for a topic. For
// personal topics it is the caller; for classroom topics the classroom owns the
// content (user_id NULL).
func (s *flashcardService) contentOwner(c context.Context, userID, topicID uuid.UUID) (uuid.NullUUID, error) {
	t, err := s.topics.Get(c, topicID)
	if err != nil {
		return uuid.NullUUID{}, err
	}
	_, err = s.goals.Get(c, userID, t.GoalID)
	if err == nil {
		return uuid.NullUUID{UUID: userID, Valid: true}, nil
	}
	// If the user isn't the goal owner, let the access checker decide; content
	// is shared (owned by the classroom) so user_id stays NULL.
	return uuid.NullUUID{}, nil
}

func (s *flashcardService) updateTopicProgress(c context.Context, userID, topicID uuid.UUID, quality int) error {
	progress, err := s.progressRepo.GetOrCreate(c, userID, topicID)
	if err != nil {
		return err
	}

	score := float64(quality) / 5.0
	newAttempts := progress.AttemptsCount + 1
	newMastery := (progress.MasteryScore*float64(progress.AttemptsCount) + score) / float64(newAttempts)

	t, err := s.topics.Get(c, topicID)
	if err != nil {
		return err
	}

	progress.AttemptsCount = newAttempts
	progress.MasteryScore = newMastery
	progress.ConfidenceScore = newMastery
	switch {
	case newMastery >= t.RequiredMastery:
		progress.Status = topic.TopicStatusMastered
	case newMastery > 0:
		progress.Status = topic.TopicStatusInProgress
	default:
		progress.Status = topic.TopicStatusLocked
	}

	return s.progressRepo.Update(c, progress)
}

// sm2 implements the SM-2 spaced repetition algorithm.
func sm2(quality int, ease float64, reps, prevInterval int32) (float64, int32, int32, error) {
	if quality < 0 || quality > 5 {
		return 0, 0, 0, apperrors.NewAppError(apperrors.ErrInvalidInput, "quality must be between 0 and 5", nil)
	}

	newEase := ease + (0.1 - float64(5-quality)*(0.08+float64(5-quality)*0.02))
	if newEase < 1.3 {
		newEase = 1.3
	}

	if quality < 3 {
		return newEase, 1, 0, nil
	}

	newReps := reps + 1
	var interval int32
	switch newReps {
	case 1:
		interval = 1
	case 2:
		interval = 6
	default:
		interval = int32(math.Round(float64(prevInterval) * newEase))
		if interval <= prevInterval {
			interval = prevInterval + 1
		}
	}
	return newEase, interval, newReps, nil
}

// cardsPerSession derives the number of cards to generate/review per session
// from the goal's time constraints.
func cardsPerSession(tc goal.TimeConstraints) int {
	n := defaultCardsPerSession
	if tc.SessionsPerDay != nil && *tc.SessionsPerDay > 0 {
		n = defaultCardsPerSession + *tc.SessionsPerDay
	}
	if tc.WeeklyMinutes != nil && *tc.WeeklyMinutes >= 90 {
		n += 4
	}
	if n > maxCardsPerSession {
		n = maxCardsPerSession
	}
	if n < minCardsPerSession {
		n = minCardsPerSession
	}
	return n
}

func parseGeneratedCards(raw string) ([]generatedCard, error) {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var resp struct {
		Cards []generatedCard `json:"cards"`
	}
	if err := json.Unmarshal([]byte(cleaned), &resp); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "invalid AI response format", err)
	}

	for _, c := range resp.Cards {
		if strings.TrimSpace(c.Front) == "" || strings.TrimSpace(c.Back) == "" {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "AI returned a card with empty front/back", nil)
		}
	}
	return resp.Cards, nil
}

func enhancePromptWithFeedback(originalPrompt string, prevErr error) string {
	return fmt.Sprintf("%s\n\n## FEEDBACK DA TENTATIVA ANTERIOR\n%s\n\nRetorne APENAS JSON válido.\n", originalPrompt, prevErr.Error())
}
