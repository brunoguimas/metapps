package user

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/go-jose/go-jose/v4/testutils/assert"
)

func TestCreateUser(t *testing.T) {
	cfg := config.Load()
	conn := database.Connect(cfg)
	queries := db.New(conn)
	repo := NewUserRepository(queries)

	user := &User{
		Username:     "betinhaplays30",
		Email:        "emaillegal@gmail.com",
		PasswordHash: "sigma",
	}

	result, err := repo.Create(context.Background(), user)

	assert.NoError(t, err)
	assert.Equal(t, user.Email, result.Email)
}
