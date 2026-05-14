package health

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeDBChecker struct {
	ok bool
}

func (f *fakeDBChecker) DBstatus(context.Context) bool { return f.ok }

func TestHealthHandlerHealthCheck_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	NewHealthHandler(&fakeDBChecker{ok: true}).HealthCheck(ctx)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "UP", resp["status"])
}

func TestHealthHandlerHealthCheck_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	NewHealthHandler(&fakeDBChecker{ok: false}).HealthCheck(ctx)

	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	var resp map[string]any
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "UP", resp["status"])
}
