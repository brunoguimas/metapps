package httpx

import (
	"errors"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetFromContext(c *gin.Context, key string) (uuid.UUID, error) {
	v, ok := c.Get(key)
	if !ok {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "missing user id", errors.New("missing user id"))
	}

	s, ok := v.(string)
	if !ok {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid user id", errors.New("invalid user id"))
	}

	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid user id", err)
	}

	return id, nil
}
