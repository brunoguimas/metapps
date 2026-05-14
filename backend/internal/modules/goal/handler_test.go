package goal

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

type fakeGoalService struct {
	createFn func(context.Context, uuid.UUID, string, json.RawMessage) (*Goal, error)
}

func (s *fakeGoalService) Create(c context.Context, userID uuid.UUID, title string, difficulties json.RawMessage) (*Goal, error) {
	return s.createFn(c, userID, title, difficulties)
}

func (s *fakeGoalService) List(context.Context, uuid.UUID) ([]*Goal, error) { return nil, nil }
func (s *fakeGoalService) Get(context.Context, uuid.UUID, uuid.UUID) (*Goal, error) {
	return nil, nil
}
func (s *fakeGoalService) Update(context.Context, uuid.UUID, uuid.UUID, string, json.RawMessage) error {
	return nil
}
func (s *fakeGoalService) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

func TestGoalHandlerCreate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	service := &fakeGoalService{
		createFn: func(_ context.Context, gotUserID uuid.UUID, title string, difficulties json.RawMessage) (*Goal, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, "Vestibular", title)
			assert.JSONEq(t, `{"math":"hard"}`, string(difficulties))
			return &Goal{ID: uuid.New(), UserID: gotUserID, Title: title, Difficulties: difficulties}, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/goals", strings.NewReader(`{"title":"Vestibular","difficulties":{"math":"hard"}}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Set("user_id", userID.String())

	NewGoalHandler(service).Create(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Goal Goal `json:"goal"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "Vestibular", resp.Goal.Title)
}

func TestGoalHandlerCreate_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeGoalService{
		createFn: func(context.Context, uuid.UUID, string, json.RawMessage) (*Goal, error) {
			t.Fatal("Create should not be called on invalid payload")
			return nil, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/goals", strings.NewReader(`{"title":"Vestibular"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Set("user_id", uuid.New().String())

	NewGoalHandler(service).Create(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	var resp struct {
		Code string `json:"code"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, string(apperrors.ErrInvalidInput), resp.Code)
}
