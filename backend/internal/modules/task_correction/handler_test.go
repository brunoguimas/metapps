package task_correction

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

type fakeCorrectionService struct {
	createFn   func(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error)
	getByAttFn func(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
	essayFn    func(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
	quizFn     func(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
}

func (s *fakeCorrectionService) CreateCorrection(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error) {
	if s.createFn != nil {
		return s.createFn(ctx, userID, attemptID, feedback, score)
	}
	return nil, nil
}

func (s *fakeCorrectionService) GetCorrectionByAttemptID(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	if s.getByAttFn != nil {
		return s.getByAttFn(ctx, userID, attemptID)
	}
	return nil, nil
}

func (s *fakeCorrectionService) UpdateCorrection(ctx context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	return correction, nil
}

func (s *fakeCorrectionService) GenerateEssayCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	if s.essayFn != nil {
		return s.essayFn(ctx, userID, attemptID)
	}
	return nil, nil
}

func (s *fakeCorrectionService) GenerateQuizCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	if s.quizFn != nil {
		return s.quizFn(ctx, userID, attemptID)
	}
	return nil, nil
}

func TestHandlerCreateCorrection_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	attemptID := uuid.New()

	svc := &fakeCorrectionService{
		createFn: func(_ context.Context, gotUserID, gotAttemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, attemptID, gotAttemptID)
			assert.Equal(t, "Bom trabalho", feedback)
			return &TaskCorrection{
				ID:        uuid.New(),
				AttemptID: gotAttemptID,
				Feedback:  feedback,
				Score:     score,
				Status:    StatusCompleted,
			}, nil
		},
	}

	handler := NewHandler(svc, nil)

	body := `{"attempt_id":"` + attemptID.String() + `","feedback":"Bom trabalho","score":0.9}`
	req := httptest.NewRequest(http.MethodPost, "/protected/corrections", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = req
	c.Set("user_id", userID.String())

	handler.CreateCorrection(c)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Correction TaskCorrection `json:"correction"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, attemptID, resp.Correction.AttemptID)
	assert.Equal(t, "Bom trabalho", resp.Correction.Feedback)
}

func TestHandlerGetCorrectionByAttemptID_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	attemptID := uuid.New()

	svc := &fakeCorrectionService{
		getByAttFn: func(_ context.Context, gotUserID, gotAttemptID uuid.UUID) (*TaskCorrection, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, attemptID, gotAttemptID)
			return &TaskCorrection{
				ID:        uuid.New(),
				AttemptID: gotAttemptID,
				Feedback:  "Ótima resposta",
				Status:    StatusCompleted,
			}, nil
		},
	}

	handler := NewHandler(svc, nil)

	req := httptest.NewRequest(http.MethodGet, "/protected/corrections/attempt/"+attemptID.String(), nil)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = req
	c.Params = gin.Params{{Key: "attemptID", Value: attemptID.String()}}
	c.Set("user_id", userID.String())

	handler.GetCorrectionByAttemptID(c)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp struct {
		Correction TaskCorrection `json:"correction"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, attemptID, resp.Correction.AttemptID)
	assert.Equal(t, "Ótima resposta", resp.Correction.Feedback)
}

func TestHandlerGenerateEssayCorrection_Forbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	attemptID := uuid.New()

	svc := &fakeCorrectionService{
		essayFn: func(_ context.Context, _, _ uuid.UUID) (*TaskCorrection, error) {
			return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to correct this attempt", nil)
		},
	}

	handler := NewHandler(svc, nil)

	req := httptest.NewRequest(http.MethodPost, "/protected/corrections/essay/"+attemptID.String(), nil)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = req
	c.Params = gin.Params{{Key: "attemptID", Value: attemptID.String()}}
	c.Set("user_id", userID.String())

	handler.GenerateEssayCorrection(c)

	require.Equal(t, http.StatusForbidden, rec.Code)
}
