package task

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeServiceHandler struct {
	createFn func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
}

func (s *fakeServiceHandler) Create(c context.Context, userID, topicID uuid.UUID) (*Task, error) {
	return s.createFn(c, userID, topicID)
}

func (s *fakeServiceHandler) GetByUserID(context.Context, uuid.UUID) ([]*Task, error) {
	return nil, nil
}
func (s *fakeServiceHandler) GetByID(context.Context, uuid.UUID, uuid.UUID) (*Task, error) {
	return nil, nil
}

func TestHandlerGenerate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	topicID := uuid.New()

	handler := NewHandler(&fakeServiceHandler{
		createFn: func(_ context.Context, gotUserID, gotTopicID uuid.UUID) (*Task, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, topicID, gotTopicID)
			return &Task{ID: uuid.New(), UserID: gotUserID, TopicID: gotTopicID, Type: TaskQuiz}, nil
		},
	}, nil, &config.Config{})

	req := httptest.NewRequest(http.MethodPost, "/tasks/generate", strings.NewReader(`{"topic_id":"`+topicID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Set("user_id", userID.String())

	handler.Generate(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Message string `json:"message"`
		Task    Task   `json:"task"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "task generated", resp.Message)
	assert.Equal(t, topicID, resp.Task.TopicID)
}

func TestHandlerGenerate_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&fakeServiceHandler{
		createFn: func(context.Context, uuid.UUID, uuid.UUID) (*Task, error) {
			t.Fatal("Create should not be called on invalid payload")
			return nil, nil
		},
	}, nil, &config.Config{})

	req := httptest.NewRequest(http.MethodPost, "/tasks/generate", strings.NewReader(`{"topic_id":"bad-uuid"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Set("user_id", uuid.New().String())

	handler.Generate(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	var resp struct {
		Code string `json:"code"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, string(apperrors.ErrInvalidInput), resp.Code)
}

var _ goal.Service = nil
