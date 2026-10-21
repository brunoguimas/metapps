package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() { gin.SetMode(gin.TestMode) }

func erroDe(t *testing.T, appErr error) (int, map[string]any) {
	t.Helper()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/x", nil)

	ErrorFrom(c, appErr)

	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return w.Code, body
}

// 503 é o provedor de IA fora do ar. A mensagem precisa chegar ao cliente:
// é ela que diz "repetir pode funcionar". 503 é >= 500, então a comparação
// ingênua escondia a mensagem e o front não conseguia diferenciar retry de bug.
func TestErrorFrom_503NaoESanitizado(t *testing.T) {
	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrUpstreamUnavailable,
		"ai provider is temporarily unavailable, please try again",
		nil,
	))

	assert.Equal(t, http.StatusServiceUnavailable, status)
	assert.Equal(t, "UPSTREAM_UNAVAILABLE", body["code"])
	assert.Equal(t, "ai provider is temporarily unavailable, please try again", body["error"])
}

// 500 continua mascarado: o detalhe interno não pode vazar.
func TestErrorFrom_500ContinuaSanitizado(t *testing.T) {
	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrInternal,
		"couldn't read roadmap schema: open /etc/passwd: permission denied",
		nil,
	))

	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "INTERNAL_ERROR", body["code"])
	assert.Equal(t, "internal server error", body["error"])
}

// INVALID_AI_RESPONSE é 500 e carrega o erro de parse do modelo — também
// precisa ficar mascarado.
func TestErrorFrom_InvalidAIResponseSanitizado(t *testing.T) {
	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrInvalidAIResponse,
		"invalid json: invalid character 'i' looking for beginning of object key",
		nil,
	))

	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "INVALID_AI_RESPONSE", body["code"])
	assert.Equal(t, "internal server error", body["error"])
}

// 4xx nunca foi sanitizado e não pode voltar a ser.
func TestErrorFrom_4xxNaoESanitizado(t *testing.T) {
	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrGoalAlreadyExists,
		"goal title already exists",
		nil,
	))

	assert.Equal(t, http.StatusConflict, status)
	assert.Equal(t, "goal title already exists", body["error"])
}

// Um erro que não é AppError cai no ramo genérico: 500 + INTERNAL_ERROR.
func TestErrorFrom_ErroNaoAppError(t *testing.T) {
	status, body := erroDe(t, assertErr{})

	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "INTERNAL_ERROR", body["code"])
	assert.Equal(t, "internal server error", body["error"])
}

type assertErr struct{}

func (assertErr) Error() string { return "pq: duplicate key value" }

// Regression do bug que motivou isto: a tabela `friendships` (migration 000023)
// não tinha sido aplicada, e TODO /protected/social/friends respondia
// 500 {"error":"internal server error"} sem nenhuma pista. Com a promotion
// para ErrSchemaOutOfSync, o cliente recebe a causa real.
func TestErrorFrom_SchemaForaDeSyncNaoESanitizado(t *testing.T) {
	missingTable := &pq.Error{
		Code:    "42P01",
		Message: `relation "friendships" does not exist`,
	}

	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrInternal,
		"couldn't list friends",
		missingTable,
	))

	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "SCHEMA_OUT_OF_SYNC", body["code"])
	assert.Equal(t, "database schema is out of sync with the code: a migration is missing", body["error"])
}

// Um pq.Error que NÃO é de schema (ex.: violação de unicidade) tem que
// continuar mascarado — a promotion é só para os SQLSTATEs de schema.
func TestErrorFrom_PqNaoDeSchemaContinuaSanitizado(t *testing.T) {
	other := &pq.Error{Code: "23505", Message: "duplicate key value violates unique constraint"}

	status, body := erroDe(t, apperrors.NewAppError(
		apperrors.ErrInternal,
		"couldn't add friend",
		other,
	))

	assert.Equal(t, http.StatusInternalServerError, status)
	assert.Equal(t, "INTERNAL_ERROR", body["code"])
	assert.Equal(t, "internal server error", body["error"])
}
