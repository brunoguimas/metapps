package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/auth/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAuthService struct {
	registerFn func(context.Context, *dto.RegisterRequest) (*user.User, error)
	loginFn    func(context.Context, *dto.LoginRequest) (*user.User, error)
}

func (s *fakeAuthService) Register(c context.Context, req *dto.RegisterRequest) (*user.User, error) {
	return s.registerFn(c, req)
}

func (s *fakeAuthService) Login(c context.Context, req *dto.LoginRequest) (*user.User, error) {
	return s.loginFn(c, req)
}

type fakeEmailService struct {
	createEmailCodeFn      func(context.Context, uuid.UUID) (string, error)
	sendVerificationCodeFn func(context.Context, string, string, string) error
}

func (s *fakeEmailService) CreateEmailCode(c context.Context, userID uuid.UUID) (string, error) {
	return s.createEmailCodeFn(c, userID)
}

func (s *fakeEmailService) SendVerificationCode(c context.Context, userEmail, username, code string) error {
	return s.sendVerificationCodeFn(c, userEmail, username, code)
}

func (s *fakeEmailService) VerifyEmailCode(context.Context, uuid.UUID, string) error {
	return nil
}

func (s *fakeEmailService) CreatePasswordResetCode(context.Context, uuid.UUID) (string, error) {
	return "", nil
}

func (s *fakeEmailService) VerifyPasswordResetCode(context.Context, uuid.UUID, string) error {
	return nil
}

func (s *fakeEmailService) SendPasswordResetCode(context.Context, string, string, string) error {
	return nil
}

type fakeJWTRepository struct{}

func (r *fakeJWTRepository) CreateRefreshToken(context.Context, uuid.UUID, time.Time) (uuid.UUID, error) {
	return uuid.New(), nil
}

func (r *fakeJWTRepository) GetRefreshToken(context.Context, uuid.UUID) (*jwt.RefreshToken, error) {
	return &jwt.RefreshToken{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		ExpiresAt: time.Now().Add(time.Hour),
		Revoked:   false,
	}, nil
}

func (r *fakeJWTRepository) RevokeRefreshToken(context.Context, uuid.UUID) error {
	return nil
}

func newTestJWTService() jwt.JWTService {
	return jwt.NewJWTService(&fakeJWTRepository{}, "test-secret", "test-issuer", time.Minute, time.Hour)
}

func TestAuthHandlerRegister_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	var receivedRegister *dto.RegisterRequest
	var emailCodeUserID uuid.UUID
	var sentEmail, sentUsername, sentCode string

	authService := &fakeAuthService{
		registerFn: func(ctx context.Context, req *dto.RegisterRequest) (*user.User, error) {
			receivedRegister = req
			return &user.User{
				ID:       userID,
				Username: req.Username,
				Email:    req.Email,
			}, nil
		},
	}

	emailService := &fakeEmailService{
		createEmailCodeFn: func(ctx context.Context, id uuid.UUID) (string, error) {
			emailCodeUserID = id
			return "123456", nil
		},
		sendVerificationCodeFn: func(ctx context.Context, userEmail, username, code string) error {
			sentEmail = userEmail
			sentUsername = username
			sentCode = code
			return nil
		},
	}

	handler := NewAuthHandler(authService, nil, nil, emailService, config.Config{})

	req := httptest.NewRequest(
		http.MethodPost,
		"/auth/register",
		strings.NewReader(`{"username":"bruno","email":"bruno@test.com","password":"forte123"}`),
	)
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	handler.Register(ctx)

	require.Equal(t, http.StatusCreated, rec.Code)
	require.NotNil(t, receivedRegister)

	assert.Equal(t, "bruno", receivedRegister.Username)
	assert.Equal(t, "bruno@test.com", receivedRegister.Email)
	assert.Equal(t, "forte123", receivedRegister.Password)
	assert.Equal(t, userID, emailCodeUserID)
	assert.Equal(t, "bruno@test.com", sentEmail)
	assert.Equal(t, "bruno", sentUsername)
	assert.Equal(t, "123456", sentCode)

	var resp struct {
		Message string `json:"message"`
		User    struct {
			ID    uuid.UUID `json:"id"`
			Email string    `json:"email"`
		} `json:"user"`
	}

	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "user registered with success", resp.Message)
	assert.Equal(t, userID, resp.User.ID)
	assert.Equal(t, "bruno@test.com", resp.User.Email)
}

func TestAuthHandlerRegister_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	authService := &fakeAuthService{
		registerFn: func(context.Context, *dto.RegisterRequest) (*user.User, error) {
			return nil, apperrors.NewAppError(apperrors.ErrUserAlreadyExists, "user already exists", nil)
		},
	}

	emailService := &fakeEmailService{
		createEmailCodeFn: func(context.Context, uuid.UUID) (string, error) {
			t.Fatal("CreateEmailCode should not be called on register failure")
			return "", nil
		},
		sendVerificationCodeFn: func(context.Context, string, string, string) error {
			t.Fatal("SendVerificationCode should not be called on register failure")
			return nil
		},
	}

	handler := NewAuthHandler(authService, nil, nil, emailService, config.Config{})

	req := httptest.NewRequest(
		http.MethodPost,
		"/auth/register",
		strings.NewReader(`{"username":"bruno","email":"bruno@test.com","password":"forte123"}`),
	)
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	handler.Register(ctx)

	require.Equal(t, http.StatusInternalServerError, rec.Code)

	var resp struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}

	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "user already exists", resp.Error)
	assert.Equal(t, string(apperrors.ErrUserAlreadyExists), resp.Code)
}

func TestAuthHandlerLogin_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	var receivedLogin *dto.LoginRequest

	authService := &fakeAuthService{
		loginFn: func(ctx context.Context, req *dto.LoginRequest) (*user.User, error) {
			receivedLogin = req
			return &user.User{
				ID:       userID,
				Email:    req.Email,
				Verified: true,
			}, nil
		},
	}

	handler := NewAuthHandler(
		authService,
		nil,
		newTestJWTService(),
		nil,
		config.Config{
			RequireEmailVerification: true,
			RefreshTokenTTL:          time.Hour,
			CookiePath:               "/auth/refresh",
		},
	)

	req := httptest.NewRequest(
		http.MethodPost,
		"/auth/login",
		strings.NewReader(`{"email":"bruno@test.com","password":"forte123"}`),
	)
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	handler.Login(ctx)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotNil(t, receivedLogin)
	assert.Equal(t, "bruno@test.com", receivedLogin.Email)
	assert.Equal(t, "forte123", receivedLogin.Password)

	var resp struct {
		Message     string `json:"message"`
		AccessToken string `json:"access_token"`
	}

	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "login successful", resp.Message)
	assert.NotEmpty(t, resp.AccessToken)

	cookies := rec.Result().Cookies()
	require.NotEmpty(t, cookies)
	assert.Equal(t, "refresh_token", cookies[0].Name)
	assert.NotEmpty(t, cookies[0].Value)
}

func TestAuthHandlerLogin_Fail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	authService := &fakeAuthService{
		loginFn: func(context.Context, *dto.LoginRequest) (*user.User, error) {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidCredentials, "invalid email or password", nil)
		},
	}

	handler := NewAuthHandler(authService, nil, nil, nil, config.Config{})

	req := httptest.NewRequest(
		http.MethodPost,
		"/auth/login",
		strings.NewReader(`{"email":"bruno@test.com","password":"wrongpass"}`),
	)
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	handler.Login(ctx)

	require.Equal(t, http.StatusUnauthorized, rec.Code)

	var resp struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}

	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "invalid email or password", resp.Error)
	assert.Equal(t, string(apperrors.ErrInvalidCredentials), resp.Code)
}
