package task_attempt

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeTaskAttemptServiceHandler struct {
	submitFn func(context.Context, uuid.UUID, uuid.UUID, *CreateAttemptInput) (*TaskAttempt, *task.Task, error)
}

func (s *fakeTaskAttemptServiceHandler) Submit(c context.Context, userID, taskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
	return s.submitFn(c, userID, taskID, input)
}

func (s *fakeTaskAttemptServiceHandler) ListByUser(context.Context, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}
func (s *fakeTaskAttemptServiceHandler) ListByUserAndTask(context.Context, uuid.UUID, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}

func TestTaskAttemptHandlerSubmit_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	taskID := uuid.New()

	handler := NewHandler(&fakeTaskAttemptServiceHandler{
		submitFn: func(_ context.Context, gotUserID, gotTaskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, taskID, gotTaskID)
			assert.Equal(t, task.TaskEssay, input.Type)
			return &TaskAttempt{ID: uuid.New(), UserID: gotUserID, TaskID: gotTaskID}, &task.Task{ID: gotTaskID, Done: true}, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/tasks/"+taskID.String()+"/attempts", strings.NewReader(`{"type":"essay","response":"minha resposta"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: taskID.String()}}
	ctx.Set("user_id", userID.String())

	handler.Submit(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Message string      `json:"message"`
		Task    task.Task   `json:"task"`
		Attempt TaskAttempt `json:"task_attempt"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "task attempt submitted", resp.Message)
	assert.Equal(t, taskID, resp.Task.ID)
}

func TestTaskAttemptHandlerSubmit_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&fakeTaskAttemptServiceHandler{
		submitFn: func(context.Context, uuid.UUID, uuid.UUID, *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
			t.Fatal("Submit should not be called on invalid payload")
			return nil, nil, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/tasks/id/attempts", strings.NewReader(`{"type":"essay"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
	ctx.Set("user_id", uuid.New().String())

	handler.Submit(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	var resp struct {
		Code string `json:"code"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, string(apperrors.ErrInvalidInput), resp.Code)
}

func TestTaskAttemptHandlerSubmit_FailInvalidTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&fakeTaskAttemptServiceHandler{
		submitFn: func(context.Context, uuid.UUID, uuid.UUID, *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
			t.Fatal("Submit should not be called with invalid task id")
			return nil, nil, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/tasks/not-a-uuid/attempts", strings.NewReader(`{"type":"essay","response":"minha resposta"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
	ctx.Set("user_id", uuid.New().String())

	handler.Submit(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	var resp struct {
		Code string `json:"code"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, string(apperrors.ErrInvalidInput), resp.Code)
}

func TestTaskAttemptHandlerSubmit_AcceptsTaskIDParamAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	taskID := uuid.New()

	handler := NewHandler(&fakeTaskAttemptServiceHandler{
		submitFn: func(_ context.Context, gotUserID, gotTaskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, taskID, gotTaskID)
			assert.Equal(t, task.TaskEssay, input.Type)
			return &TaskAttempt{ID: uuid.New(), UserID: gotUserID, TaskID: gotTaskID}, &task.Task{ID: gotTaskID, Done: true}, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/tasks/"+taskID.String()+"/attempts", strings.NewReader(`{"type":"essay","response":"minha resposta"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "taskid", Value: taskID.String()}}
	ctx.Set("user_id", userID.String())

	handler.Submit(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
}
