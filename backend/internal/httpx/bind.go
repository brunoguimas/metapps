package httpx

import (
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
)

func BindJSON[T any](c *gin.Context) (*T, error) {
	var g T
	if err := c.ShouldBindJSON(&g); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err)
	}

	return &g, nil
}
