package middleware

import (
	"net/http"
	"strings"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware(s service.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
			return
		}

		claims, err := s.ValidateAccessToken(parts[1])
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				c.AbortWithStatusJSON(appErr.Status(), gin.H{
					"error": appErr.Error(),
					"code":  appErr.Code(),
				})
				return
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("user_id", claims.Subject)
		c.Set("claims", claims)
		c.Next()
	}
}
