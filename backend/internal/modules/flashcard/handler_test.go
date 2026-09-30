package flashcard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeHandlerService struct {
	generateFn  func(context.Context, uuid.UUID, uuid.UUID) ([]*Flashcard, error)
	createFn    func(context.Context, uuid.UUID, *CreateManualInput) (*Flashcard, error)
	listTopicFn func(context.Context, uuid.UUID, uuid.UUID) ([]*DeckCard, error)
	listDueFn   func(context.Context, uuid.UUID) ([]*DeckCard, error)
	listRevFn   func(context.Context, uuid.UUID) ([]*DeckCard, error)
	reviewFn    func(context.Context, uuid.UUID, uuid.UUID, *ReviewInput) (*DeckCard, error)
	deleteFn    func(context.Context, uuid.UUID, uuid.UUID) error
}

func (s *fakeHandlerService) Generate(ctx context.Context, u, t uuid.UUID) ([]*Flashcard, error) {
	return s.generateFn(ctx, u, t)
}
func (s *fakeHandlerService) Create(ctx context.Context, u uuid.UUID, in *CreateManualInput) (*Flashcard, error) {
	return s.createFn(ctx, u, in)
}
func (s *fakeHandlerService) ListByTopic(ctx context.Context, u, t uuid.UUID) ([]*DeckCard, error) {
	return s.listTopicFn(ctx, u, t)
}
func (s *fakeHandlerService) ListDue(ctx context.Context, u uuid.UUID) ([]*DeckCard, error) {
	return s.listDueFn(ctx, u)
}
func (s *fakeHandlerService) ListReview(ctx context.Context, u uuid.UUID) ([]*DeckCard, error) {
	return s.listRevFn(ctx, u)
}
func (s *fakeHandlerService) Review(ctx context.Context, u, id uuid.UUID, in *ReviewInput) (*DeckCard, error) {
	return s.reviewFn(ctx, u, id, in)
}
func (s *fakeHandlerService) Delete(ctx context.Context, u, id uuid.UUID) error {
	return s.deleteFn(ctx, u, id)
}

func setup(userID string, handler *Handler) (*gin.Context, *httptest.ResponseRecorder) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Set("user_id", userID)
	return c, rec
}

func TestHandlerCreate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()

	h := NewHandler(&fakeHandlerService{
		createFn: func(_ context.Context, u uuid.UUID, in *CreateManualInput) (*Flashcard, error) {
			assert.Equal(t, in.TopicID, in.TopicID)
			return &Flashcard{ID: uuid.New(), UserID: uuid.NullUUID{UUID: u, Valid: true}, TopicID: in.TopicID, Front: in.Front, Back: in.Back, Source: SourceManual}, nil
		},
	})

	c, rec := setup(userID, h)
	body := `{"topic_id":"` + uuid.New().String() + `","front":"Pergunta","back":"Resposta"}`
	c.Request = httptest.NewRequest(http.MethodPost, "/protected/flashcards", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	require.Equal(t, http.StatusCreated, rec.Code)
}

func TestHandlerCreate_InvalidPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(&fakeHandlerService{
		createFn: func(context.Context, uuid.UUID, *CreateManualInput) (*Flashcard, error) {
			t.Fatal("Create should not be called")
			return nil, nil
		},
	})

	c, rec := setup(uuid.New().String(), h)
	c.Request = httptest.NewRequest(http.MethodPost, "/protected/flashcards", strings.NewReader(`{"topic_id":"bad"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandlerGenerate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()

	h := NewHandler(&fakeHandlerService{
		generateFn: func(_ context.Context, _, topicID uuid.UUID) ([]*Flashcard, error) {
			return []*Flashcard{
				{ID: uuid.New(), TopicID: topicID, Source: SourceAI, Front: "Q", Back: "A"},
			}, nil
		},
	})

	c, rec := setup(userID, h)
	body := `{"topic_id":"` + uuid.New().String() + `"}`
	c.Request = httptest.NewRequest(http.MethodPost, "/protected/flashcards/generate", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Generate(c)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Flashcards []Flashcard `json:"flashcards"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Len(t, resp.Flashcards, 1)
}

func TestHandlerReview_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()
	cardID := uuid.New()

	h := NewHandler(&fakeHandlerService{
		reviewFn: func(_ context.Context, u, id uuid.UUID, in *ReviewInput) (*DeckCard, error) {
			assert.Equal(t, 5, in.Quality)
			return &DeckCard{FlashcardID: id, Front: "reviewed"}, nil
		},
	})

	c, rec := setup(userID, h)
	body := `{"quality":5}`
	c.Request = httptest.NewRequest(http.MethodPost, "/protected/flashcards/"+cardID.String()+"/review", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: cardID.String()}}

	h.Review(c)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestHandlerReview_ForbiddenPropagatesError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()
	cardID := uuid.New()

	h := NewHandler(&fakeHandlerService{
		reviewFn: func(context.Context, uuid.UUID, uuid.UUID, *ReviewInput) (*DeckCard, error) {
			return nil, apperrors.NewAppError(apperrors.ErrForbidden, "forbidden", nil)
		},
	})

	c, rec := setup(userID, h)
	body := `{"quality":4}`
	c.Request = httptest.NewRequest(http.MethodPost, "/protected/flashcards/"+cardID.String()+"/review", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: cardID.String()}}

	h.Review(c)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestHandlerListByTopic_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()

	h := NewHandler(&fakeHandlerService{
		listTopicFn: func(_ context.Context, _, _ uuid.UUID) ([]*DeckCard, error) {
			return []*DeckCard{{FlashcardID: uuid.New()}}, nil
		},
	})

	c, rec := setup(userID, h)
	c.Request = httptest.NewRequest(http.MethodGet, "/protected/flashcards?topic_id="+uuid.New().String(), nil)

	h.ListByTopic(c)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestHandlerListReview_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()

	h := NewHandler(&fakeHandlerService{
		listRevFn: func(_ context.Context, _ uuid.UUID) ([]*DeckCard, error) {
			return []*DeckCard{{FlashcardID: uuid.New()}}, nil
		},
	})

	c, rec := setup(userID, h)
	c.Request = httptest.NewRequest(http.MethodGet, "/protected/flashcards/review", nil)

	h.ListReview(c)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestHandlerDelete_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New().String()
	cardID := uuid.New()

	h := NewHandler(&fakeHandlerService{
		deleteFn: func(_ context.Context, _, id uuid.UUID) error {
			assert.Equal(t, cardID, id)
			return nil
		},
	})

	c, rec := setup(userID, h)
	c.Request = httptest.NewRequest(http.MethodDelete, "/protected/flashcards/"+cardID.String(), nil)
	c.Params = gin.Params{{Key: "id", Value: cardID.String()}}

	h.Delete(c)

	require.Equal(t, http.StatusOK, rec.Code)
}
