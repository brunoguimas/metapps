package oauth

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAuthRepositoryCreateAccount_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewOAuthAccountRepository(queries)

	result, err := repo.CreateAccount(context.Background(), &OAuthAccount{
		UserID:         user.ID,
		Provider:       "google",
		ProviderUserID: "google-sub-1",
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, "google", result.Provider)
}

func TestOAuthRepositoryGetAccountByProviderID_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	repo := NewOAuthAccountRepository(queries)
	result, err := repo.GetAccountByProviderID(context.Background(), "google", "missing")

	require.NoError(t, err)
	assert.Nil(t, result)
}
