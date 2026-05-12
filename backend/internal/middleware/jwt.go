package middleware

import (
	"net/http"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware(s jwt.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
			httpx.Error(c, http.StatusUnauthorized, "missing or invalid authorization header")
			c.Abort()
			return
		}

		claims, err := s.ValidateAccessToken(parts[1])
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				httpx.Status(c, appErr.Status(), gin.H{
					"error": appErr.Error(),
					"code":  appErr.Code(),
				}, appErr.Error())
				c.Abort()
				return
			}
			httpx.Error(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		c.Set("user_id", claims.Subject)
		c.Set("claims", claims)
		c.Next()
	}
}
