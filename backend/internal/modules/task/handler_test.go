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

type fakeTaskServiceHandler struct {
	createFn func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
}

func (s *fakeTaskServiceHandler) Create(c context.Context, userID, goalID uuid.UUID) (*Task, error) {
	return s.createFn(c, userID, goalID)
}

func (s *fakeTaskServiceHandler) GetByUserID(context.Context, uuid.UUID) ([]*Task, error) { return nil, nil }
func (s *fakeTaskServiceHandler) GetByID(context.Context, uuid.UUID, uuid.UUID) (*Task, error) {
	return nil, nil
}

func TestTaskHandlerGenerate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	goalID := uuid.New()

	handler := NewTaskHandler(&fakeTaskServiceHandler{
		createFn: func(_ context.Context, gotUserID, gotGoalID uuid.UUID) (*Task, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, goalID, gotGoalID)
			return &Task{ID: uuid.New(), UserID: gotUserID, GoalID: gotGoalID, Type: TaskEssay}, nil
		},
	}, nil, &config.Config{})

	req := httptest.NewRequest(http.MethodPost, "/tasks/generate", strings.NewReader(`{"goal_id":"`+goalID.String()+`"}`))
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
	assert.Equal(t, goalID, resp.Task.GoalID)
}

func TestTaskHandlerGenerate_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewTaskHandler(&fakeTaskServiceHandler{
		createFn: func(context.Context, uuid.UUID, uuid.UUID) (*Task, error) {
			t.Fatal("Create should not be called on invalid payload")
			return nil, nil
		},
	}, nil, &config.Config{})

	req := httptest.NewRequest(http.MethodPost, "/tasks/generate", strings.NewReader(`{"goal_id":"bad-uuid"}`))
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

var _ goal.GoalService = nil
