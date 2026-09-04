package middleware

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(c *gin.Context) {
		role := c.GetString("user_role")
		if !allowed[role] {
			httpx.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}
		c.Next()
	}
}
