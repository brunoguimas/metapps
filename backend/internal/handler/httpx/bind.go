package httpx

import "github.com/gin-gonic/gin"

func BindJSON[T any](c *gin.Context) (*T, error) {
	var g T
	if err := c.ShouldBindJSON(&g); err != nil {
		return nil, err
	}

	return &g, nil
}
