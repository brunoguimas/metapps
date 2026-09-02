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

type fakeService struct {
	createFn func(context.Context, uuid.UUID, *Request) (*Goal, error)
}

func (s *fakeService) Create(c context.Context, userID uuid.UUID, req *Request) (*Goal, error) {
	return s.createFn(c, userID, req)
}

func (s *fakeService) List(context.Context, uuid.UUID) ([]*Goal, error) { return nil, nil }
func (s *fakeService) Get(context.Context, uuid.UUID, uuid.UUID) (*Goal, error) {
	return nil, nil
}
func (s *fakeService) Update(context.Context, uuid.UUID, uuid.UUID, *Request) error {
	return nil
}
func (s *fakeService) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

func TestHandlerCreate_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	service := &fakeService{
		createFn: func(_ context.Context, gotUserID uuid.UUID, req *Request) (*Goal, error) {
			assert.Equal(t, userID, gotUserID)
			assert.Equal(t, "Vestibular", req.Title)
			assert.Equal(t, "passar no vestibular", req.Settings.Motivation)
			return &Goal{ID: uuid.New(), UserID: gotUserID, Title: req.Title, Settings: req.Settings}, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/goals", strings.NewReader(`{"title":"Vestibular","settings":{"motivation":"passar no vestibular"}}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req
	ctx.Set("user_id", userID.String())

	NewHandler(service).Create(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp struct {
		Goal Goal `json:"goal"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "Vestibular", resp.Goal.Title)
}

func TestHandlerCreate_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeService{
		createFn: func(context.Context, uuid.UUID, *Request) (*Goal, error) {
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

	NewHandler(service).Create(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	var resp struct {
		Code string `json:"code"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, string(apperrors.ErrInvalidInput), resp.Code)
}
