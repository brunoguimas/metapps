package flashcard

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAIClient struct {
	generateFn func(context.Context, string) (string, error)
}

func (c *fakeAIClient) Generate(ctx context.Context, prompt string) (string, error) {
	return c.generateFn(ctx, prompt)
}

type fakeRepo struct {
	createFn       func(context.Context, *Flashcard) (*Flashcard, error)
	getByIDFn      func(context.Context, uuid.UUID) (*Flashcard, error)
	listTopicFn    func(context.Context, uuid.UUID) ([]*Flashcard, error)
	updateFn       func(context.Context, *Flashcard) (*Flashcard, error)
	deleteFn       func(context.Context, uuid.UUID) error
	upsertProgFn   func(context.Context, *FlashcardProgress) (*FlashcardProgress, error)
	getProgFn      func(context.Context, uuid.UUID, uuid.UUID) (*FlashcardProgress, error)
	updateProgFn   func(context.Context, *FlashcardProgress) (*FlashcardProgress, error)
	listDueFn      func(context.Context, uuid.UUID, int32) ([]*DeckCard, error)
	dueTopicFn     func(context.Context, uuid.UUID, []uuid.UUID, int32) ([]*DeckCard, error)
	listUserTopicFn func(context.Context, uuid.UUID, uuid.UUID) ([]*DeckCard, error)
}

func (r *fakeRepo) Create(ctx context.Context, f *Flashcard) (*Flashcard, error) {
	return r.createFn(ctx, f)
}
func (r *fakeRepo) GetByID(ctx context.Context, id uuid.UUID) (*Flashcard, error) {
	return r.getByIDFn(ctx, id)
}
func (r *fakeRepo) ListByTopic(ctx context.Context, topicID uuid.UUID) ([]*Flashcard, error) {
	return r.listTopicFn(ctx, topicID)
}
func (r *fakeRepo) Update(ctx context.Context, f *Flashcard) (*Flashcard, error) {
	return r.updateFn(ctx, f)
}
func (r *fakeRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.deleteFn(ctx, id)
}
func (r *fakeRepo) UpsertProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
	return r.upsertProgFn(ctx, p)
}
func (r *fakeRepo) GetProgress(ctx context.Context, userID, flashcardID uuid.UUID) (*FlashcardProgress, error) {
	return r.getProgFn(ctx, userID, flashcardID)
}
func (r *fakeRepo) UpdateProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
	return r.updateProgFn(ctx, p)
}
func (r *fakeRepo) ListByUserAndTopic(ctx context.Context, userID, topicID uuid.UUID) ([]*DeckCard, error) {
	return r.listUserTopicFn(ctx, userID, topicID)
}
func (r *fakeRepo) ListDueByUser(ctx context.Context, userID uuid.UUID, limit int32) ([]*DeckCard, error) {
	return r.listDueFn(ctx, userID, limit)
}
func (r *fakeRepo) ListDueByTopicIDs(ctx context.Context, userID uuid.UUID, topicIDs []uuid.UUID, limit int32) ([]*DeckCard, error) {
	return r.dueTopicFn(ctx, userID, topicIDs, limit)
}

type fakeTopicService struct {
	getFn func(context.Context, uuid.UUID) (*topic.Topic, error)
}

func (s *fakeTopicService) GenerateRoadmap(context.Context, *goal.Goal) (*topic.Roadmap, error) {
	return nil, nil
}
func (s *fakeTopicService) GetRoadmap(context.Context, uuid.UUID) (*topic.Roadmap, error) {
	return nil, nil
}
func (s *fakeTopicService) Get(ctx context.Context, id uuid.UUID) (*topic.Topic, error) {
	return s.getFn(ctx, id)
}

type fakeTopicRepo struct {
	getByGoalIDFn func(context.Context, uuid.UUID) ([]*topic.Topic, error)
}

func (r *fakeTopicRepo) Create(context.Context, *topic.Topic) (*topic.Topic, error) { return nil, nil }
func (r *fakeTopicRepo) Get(context.Context, uuid.UUID) (*topic.Topic, error)       { return nil, nil }
func (r *fakeTopicRepo) GetByGoalID(ctx context.Context, g uuid.UUID) ([]*topic.Topic, error) {
	return r.getByGoalIDFn(ctx, g)
}
func (r *fakeTopicRepo) DeleteByGoalID(context.Context, uuid.UUID) error { return nil }

type fakeProgressRepo struct {
	getOrCreateFn func(context.Context, uuid.UUID, uuid.UUID) (*topic.TopicProgress, error)
	updateFn      func(context.Context, *topic.TopicProgress) error
}

func (r *fakeProgressRepo) GetOrCreate(ctx context.Context, u, t uuid.UUID) (*topic.TopicProgress, error) {
	return r.getOrCreateFn(ctx, u, t)
}
func (r *fakeProgressRepo) Update(ctx context.Context, p *topic.TopicProgress) error {
	return r.updateFn(ctx, p)
}

type fakeGoalService struct {
	listFn func(context.Context, uuid.UUID) ([]*goal.Goal, error)
	getFn  func(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error)
}

func (s *fakeGoalService) Create(context.Context, uuid.UUID, *goal.Request) (*goal.Goal, error) {
	return nil, nil
}
func (s *fakeGoalService) List(ctx context.Context, u uuid.UUID) ([]*goal.Goal, error) {
	if s.listFn != nil {
		return s.listFn(ctx, u)
	}
	return nil, nil
}
func (s *fakeGoalService) Get(ctx context.Context, u, g uuid.UUID) (*goal.Goal, error) {
	if s.getFn != nil {
		return s.getFn(ctx, u, g)
	}
	return nil, nil
}
func (s *fakeGoalService) Update(context.Context, uuid.UUID, uuid.UUID, *goal.Request) error {
	return nil
}
func (s *fakeGoalService) Delete(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}

type fakeAccessChecker struct {
	err error
}

func (ac *fakeAccessChecker) EnsureTopicAccess(_ context.Context, _, _ uuid.UUID) error {
	if ac.err != nil {
		return ac.err
	}
	return nil
}

func newTestService(repo Repository, a ai.Client) Service {
	return NewService(
		repo,
		&fakeTopicRepo{},
		&fakeTopicService{},
		&fakeProgressRepo{},
		&fakeGoalService{},
		&fakeAccessChecker{},
		a,
		&config.Config{},
	)
}

func TestServiceCreateManual_Success(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	goalID := uuid.New()

	svc := NewService(
		&fakeRepo{
			createFn: func(_ context.Context, f *Flashcard) (*Flashcard, error) {
				f.ID = uuid.New()
				return f, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: goalID}, nil
			},
		},
		&fakeProgressRepo{},
		&fakeGoalService{
			getFn: func(_ context.Context, u, g uuid.UUID) (*goal.Goal, error) {
				assert.Equal(t, userID, u)
				assert.Equal(t, goalID, g)
				return &goal.Goal{ID: g, UserID: u}, nil
			},
		},
		&fakeAccessChecker{},
		&fakeAIClient{},
		&config.Config{},
	)

	card, err := svc.Create(context.Background(), userID, &CreateManualInput{
		TopicID: topicID,
		Front:   "O que é X?",
		Back:    "Resposta",
	})

	require.NoError(t, err)
	require.NotNil(t, card)
	assert.Equal(t, SourceManual, card.Source)
	assert.Equal(t, "O que é X?", card.Front)
	assert.Equal(t, userID, card.UserID.UUID)
}

func TestServiceCreateManual_EmptyFront(t *testing.T) {
	svc := newTestService(&fakeRepo{}, &fakeAIClient{})

	_, err := svc.Create(context.Background(), uuid.New(), &CreateManualInput{
		TopicID: uuid.New(),
		Front:   "   ",
		Back:    "Resposta",
	})

	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}

func TestServiceCreateManual_ForbiddenTopic(t *testing.T) {
	userID := uuid.New()
	goalID := uuid.New()
	topicID := uuid.New()

	svc := NewService(
		&fakeRepo{
			createFn: func(_ context.Context, f *Flashcard) (*Flashcard, error) {
				f.ID = uuid.New()
				return f, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: goalID}, nil
			},
		},
		&fakeProgressRepo{},
		&fakeGoalService{
			getFn: func(_ context.Context, u, _ uuid.UUID) (*goal.Goal, error) {
				return nil, apperrors.NewAppError(apperrors.ErrGoalNotFound, "goal not found", nil)
			},
		},
		&fakeAccessChecker{
			err: apperrors.NewAppError(apperrors.ErrForbidden, "no access", nil),
		},
		&fakeAIClient{},
		&config.Config{},
	)

	_, err := svc.Create(context.Background(), userID, &CreateManualInput{
		TopicID: topicID,
		Front:   "Pergunta",
		Back:    "Resposta",
	})

	require.Error(t, err)
}

func TestServiceCreateManual_Duplicate(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	goalID := uuid.New()

	svc := NewService(
		&fakeRepo{
			createFn: func(context.Context, *Flashcard) (*Flashcard, error) {
				return nil, apperrors.NewAppError(apperrors.ErrFlashcardDuplicate, "duplicate", nil)
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: goalID}, nil
			},
		},
		&fakeProgressRepo{},
		&fakeGoalService{
			getFn: func(_ context.Context, u, _ uuid.UUID) (*goal.Goal, error) {
				return &goal.Goal{ID: uuid.New(), UserID: u}, nil
			},
		},
		&fakeAccessChecker{},
		&fakeAIClient{},
		&config.Config{},
	)

	_, err := svc.Create(context.Background(), userID, &CreateManualInput{
		TopicID: topicID,
		Front:   "Pergunta",
		Back:    "Resposta",
	})

	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrFlashcardDuplicate, appErr.Code())
}

func TestGenerate_CreatesCards(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	goalID := uuid.New()

	created := make([]*Flashcard, 0)
	svc := NewService(
		&fakeRepo{
			createFn: func(_ context.Context, f *Flashcard) (*Flashcard, error) {
				f.ID = uuid.New()
				created = append(created, f)
				return f, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: goalID, Title: "Tópico", Description: "Desc"}, nil
			},
		},
		&fakeProgressRepo{},
		&fakeGoalService{
			getFn: func(_ context.Context, u, _ uuid.UUID) (*goal.Goal, error) {
				return &goal.Goal{ID: uuid.New(), UserID: u, Title: "Meta"}, nil
			},
		},
		&fakeAccessChecker{},
		&fakeAIClient{
			generateFn: func(_ context.Context, prompt string) (string, error) {
				return `{"cards":[{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"}]}`, nil
			},
		},
		&config.Config{},
	)

	cards, err := svc.Generate(context.Background(), userID, topicID)

	require.NoError(t, err)
	require.Len(t, cards, 2)
	require.Len(t, created, 2)
	assert.Equal(t, SourceAI, created[0].Source)
	assert.Equal(t, topicID, created[0].TopicID)
}

func TestGenerate_RetriesOnInvalidAIResponse(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	goalID := uuid.New()

	calls := 0
	svc := NewService(
		&fakeRepo{
			createFn: func(_ context.Context, f *Flashcard) (*Flashcard, error) {
				f.ID = uuid.New()
				return f, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: goalID, Title: "T", Description: "D"}, nil
			},
		},
		&fakeProgressRepo{},
		&fakeGoalService{
			getFn: func(_ context.Context, u, _ uuid.UUID) (*goal.Goal, error) {
				return &goal.Goal{ID: uuid.New(), UserID: u}, nil
			},
		},
		&fakeAccessChecker{},
		&fakeAIClient{
			generateFn: func(_ context.Context, prompt string) (string, error) {
				calls++
				if calls == 1 {
					return "not json", nil
				}
				return `{"cards":[{"front":"Q","back":"A"}]}`, nil
			},
		},
		&config.Config{},
	)

	cards, err := svc.Generate(context.Background(), userID, topicID)

	require.NoError(t, err)
	require.Len(t, cards, 1)
	assert.GreaterOrEqual(t, calls, 2)
}

func TestReview_AppliesSM2AndUpdatesProgress(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	cardID := uuid.New()

	var updatedProgress *topic.TopicProgress
	svc := NewService(
		&fakeRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*Flashcard, error) {
				return &Flashcard{ID: id, UserID: uuid.NullUUID{UUID: userID, Valid: true}, TopicID: topicID}, nil
			},
			upsertProgFn: func(_ context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
				return p, nil
			},
			getProgFn: func(_ context.Context, u, f uuid.UUID) (*FlashcardProgress, error) {
				return &FlashcardProgress{UserID: u, FlashcardID: f, EaseFactor: 2.5, Repetitions: 0}, nil
			},
			updateProgFn: func(_ context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
				return p, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{
			getFn: func(_ context.Context, id uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: id, GoalID: uuid.New(), RequiredMastery: 0.8}, nil
			},
		},
		&fakeProgressRepo{
			getOrCreateFn: func(_ context.Context, u, t uuid.UUID) (*topic.TopicProgress, error) {
				return &topic.TopicProgress{UserID: u, TopicID: t, MasteryScore: 0, AttemptsCount: 0}, nil
			},
			updateFn: func(_ context.Context, p *topic.TopicProgress) error {
				updatedProgress = p
				return nil
			},
		},
		&fakeGoalService{},
		&fakeAccessChecker{},
		&fakeAIClient{},
		&config.Config{},
	)

	card, err := svc.Review(context.Background(), userID, cardID, &ReviewInput{Quality: 5})

	require.NoError(t, err)
	require.NotNil(t, card)
	assert.NotNil(t, card.Progress)
	assert.Equal(t, int32(1), card.Progress.Repetitions)
	assert.Equal(t, int32(1), card.Progress.IntervalDays)
	assert.True(t, card.Progress.EaseFactor > 2.5)
	require.NotNil(t, updatedProgress)
	assert.Equal(t, int32(1), updatedProgress.AttemptsCount)
	assert.Equal(t, 1.0, updatedProgress.MasteryScore)
	assert.Equal(t, topic.TopicStatusMastered, updatedProgress.Status)
}

func TestReview_Forbidden(t *testing.T) {
	userID := uuid.New()
	cardID := uuid.New()

	svc := NewService(
		&fakeRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*Flashcard, error) {
				return &Flashcard{ID: id, UserID: uuid.NullUUID{}, TopicID: uuid.New()}, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{},
		&fakeProgressRepo{},
		&fakeGoalService{},
		&fakeAccessChecker{
			err: apperrors.NewAppError(apperrors.ErrForbidden, "no access", nil),
		},
		&fakeAIClient{},
		&config.Config{},
	)

	_, err := svc.Review(context.Background(), userID, cardID, &ReviewInput{Quality: 4})

	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrForbidden, appErr.Code())
}

func TestReview_InvalidQuality(t *testing.T) {
	userID := uuid.New()
	cardID := uuid.New()

	svc := NewService(
		&fakeRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*Flashcard, error) {
				return &Flashcard{ID: id, UserID: uuid.NullUUID{UUID: userID, Valid: true}}, nil
			},
			getProgFn: func(_ context.Context, u, f uuid.UUID) (*FlashcardProgress, error) {
				return &FlashcardProgress{UserID: u, FlashcardID: f, EaseFactor: 2.5}, nil
			},
		},
		&fakeTopicRepo{},
		&fakeTopicService{},
		&fakeProgressRepo{},
		&fakeGoalService{},
		&fakeAccessChecker{},
		&fakeAIClient{},
		&config.Config{},
	)

	_, err := svc.Review(context.Background(), userID, cardID, &ReviewInput{Quality: 9})

	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}

func TestListReview_AggregatesAcrossGoals(t *testing.T) {
	userID := uuid.New()
	goalID := uuid.New()
	limit := int32(0)

	svc := NewService(
		&fakeRepo{
			dueTopicFn: func(_ context.Context, u uuid.UUID, ts []uuid.UUID, l int32) ([]*DeckCard, error) {
				limit = l
				assert.Len(t, ts, 2)
				return []*DeckCard{}, nil
			},
		},
		&fakeTopicRepo{
			getByGoalIDFn: func(_ context.Context, g uuid.UUID) ([]*topic.Topic, error) {
				return []*topic.Topic{{ID: uuid.New()}, {ID: uuid.New()}}, nil
			},
		},
		&fakeTopicService{},
		&fakeProgressRepo{},
		&fakeGoalService{
			listFn: func(_ context.Context, u uuid.UUID) ([]*goal.Goal, error) {
				return []*goal.Goal{{ID: goalID, UserID: u}}, nil
			},
		},
		&fakeAccessChecker{},
		&fakeAIClient{},
		&config.Config{},
	)

	cards, err := svc.ListReview(context.Background(), userID)

	require.NoError(t, err)
	require.Empty(t, cards)
	assert.Equal(t, int32(defaultCardsPerSession), limit)
}

func TestSM2(t *testing.T) {
	tests := []struct {
		name            string
		quality         int
		ease            float64
		reps            int32
		wantReps        int32
		wantIntervalMin int32
		wantEaseFloor   float64
	}{
		{"perfect first review", 5, 2.5, 0, 1, 1, 2.5},
		{"failed resets", 2, 2.5, 3, 0, 1, 1.3},
		{"ease decreases and floors at 1.3", 0, 1.3, 0, 0, 1, 1.3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newEase, interval, reps, err := sm2(tt.quality, tt.ease, tt.reps, 0)
			require.NoError(t, err)
			assert.Equal(t, tt.wantReps, reps)
			assert.GreaterOrEqual(t, interval, tt.wantIntervalMin)
			assert.GreaterOrEqual(t, newEase, tt.wantEaseFloor)
		})
	}
}

func TestSM2_IntervalGrowth(t *testing.T) {
	// Third successful review (reps becomes 3) uses previous interval * ease.
	_, interval, reps, err := sm2(4, 2.5, 2, 6)
	require.NoError(t, err)
	assert.Equal(t, int32(3), reps)
	assert.Equal(t, int32(15), interval) // 6 * 2.5 = 15

	// Bad review resets reps but still applies ease reduction.
	_, interval, reps, err = sm2(2, 2.5, 3, 15)
	require.NoError(t, err)
	assert.Equal(t, int32(1), interval)
	assert.Equal(t, int32(0), reps)

	// Ease never grows beyond a reasonable reduction and floors at 1.3.
	_, _, _, err = sm2(0, 1.3, 0, 0)
	require.NoError(t, err)

	ease, _, _, _ := sm2(0, 2.0, 0, 0)
	assert.Equal(t, 1.3, ease)
}

func TestSM2_InvalidQuality(t *testing.T) {
	_, _, _, err := sm2(6, 2.5, 0, 0)
	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}

func TestCardsPerSession(t *testing.T) {
	assert.Equal(t, defaultCardsPerSession, cardsPerSession(goal.TimeConstraints{}))

	sessions := 9
	assert.Equal(t, 15, cardsPerSession(goal.TimeConstraints{SessionsPerDay: &sessions}))

	weekly := 120
	sessions2 := 14
	got := cardsPerSession(goal.TimeConstraints{SessionsPerDay: &sessions2, WeeklyMinutes: &weekly})
	assert.Equal(t, 20, got)

	weekly3 := 120
	sessions3 := 2
	got2 := cardsPerSession(goal.TimeConstraints{SessionsPerDay: &sessions3, WeeklyMinutes: &weekly3})
	assert.Equal(t, 12, got2)
}
