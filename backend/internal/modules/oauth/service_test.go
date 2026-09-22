package oauth

import (
	"context"
	"database/sql"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/idtoken"
)

func setupService(t *testing.T) (OAuthAccountService, *db.Queries) {
	t.Helper()
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	userRepo := user.NewUserRepository(queries)
	profileSvc := profile.NewProfileService(profile.NewProfileRepository(queries))
	accountRepo := NewOAuthAccountRepository(queries)

	return NewOAuthService(accountRepo, userRepo, profileSvc), queries
}

func googlePayload(subject, email string) *idtoken.Payload {
	return &idtoken.Payload{
		Subject: subject,
		Claims: map[string]any{
			"email":          email,
			"email_verified": true,
			"name":           "Bruno",
		},
	}
}

func TestCreateAccount_NewUserCreatesUserProfileAndAccount(t *testing.T) {
	svc, queries := setupService(t)

	account, err := svc.CreateAccount(context.Background(), googlePayload("google-sub-new", "new@test.com"))
	require.NoError(t, err)
	require.NotNil(t, account)

	u, err := queries.GetUserByEmail(context.Background(), "new@test.com")
	require.NoError(t, err)
	assert.True(t, u.Verified)

	prof, err := queries.GetProfileByUserID(context.Background(), u.ID)
	require.NoError(t, err)
	assert.Equal(t, u.ID, prof.UserID)
}

func TestCreateAccount_ExistingUserWithoutProfileRecovers(t *testing.T) {
	svc, queries := setupService(t)
	u := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")

	account, err := svc.CreateAccount(context.Background(), googlePayload("google-sub-1", "bruno@test.com"))
	require.NoError(t, err)
	require.NotNil(t, account)
	assert.Equal(t, u.ID, account.UserID)

	prof, err := queries.GetProfileByUserID(context.Background(), u.ID)
	require.NoError(t, err)
	assert.Equal(t, u.ID, prof.UserID)
}

func TestCreateAccount_SameProviderIDIsIdempotent(t *testing.T) {
	svc, queries := setupService(t)
	dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")

	first, err := svc.CreateAccount(context.Background(), googlePayload("google-sub-1", "bruno@test.com"))
	require.NoError(t, err)

	second, err := svc.CreateAccount(context.Background(), googlePayload("google-sub-1", "bruno@test.com"))
	require.NoError(t, err)
	assert.Equal(t, first.ID, second.ID)
}

func TestCreateAccount_ExistingUserGetsVerified(t *testing.T) {
	svc, queries := setupService(t)

	_, err := queries.CreateOneUser(context.Background(), db.CreateOneUserParams{
		Username:     "bruno",
		Email:        "unverified@test.com",
		PasswordHash: sql.NullString{String: "hash", Valid: true},
	})
	require.NoError(t, err)

	_, err = svc.CreateAccount(context.Background(), googlePayload("google-sub-2", "unverified@test.com"))
	require.NoError(t, err)

	u, err := queries.GetUserByEmail(context.Background(), "unverified@test.com")
	require.NoError(t, err)
	assert.True(t, u.Verified)
}