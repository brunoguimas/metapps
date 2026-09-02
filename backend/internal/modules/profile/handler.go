package profile

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
	cfg     *config.Config
}

func NewHandler(service Service, cfg *config.Config) *Handler {
	return &Handler{
		service: service,
		cfg:     cfg,
	}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	profile, err := h.service.GetProfileByUserID(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"profile": profile})
}

func (h *Handler) AddXP(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req struct {
		XP int `json:"xp" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request", err))
		return
	}

	profile, err := h.service.AddXP(c.Request.Context(), userID, req.XP)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"profile": profile})
}

func (h *Handler) UpdateAvatar(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = c.Request.ParseMultipartForm(10 << 20)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "failed to parse form", err))
		return
	}

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "avatar file not found", err))
		return
	}
	defer file.Close()

	ext := GetFileExtension(header.Filename)
	if ext == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "unsupported file type (only .png, .jpg, .jpeg, .gif, .webp allowed)", nil))
		return
	}

	filename := uuid.New().String() + ext
	avatarDir := "./avatars"
	if err := ensureDir(avatarDir); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to create avatar directory", err))
		return
	}

	out, err := createFile(filepath.Join(avatarDir, filename))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to save avatar", err))
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to write avatar", err))
		return
	}

	avatarURL := h.cfg.AvatarBaseURL + "/" + filename
	_, err = h.service.UpdateAvatar(c.Request.Context(), userID, avatarURL)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"message":    "avatar uploaded successfully",
		"avatar_url": avatarURL,
	})
}

func GetFileExtension(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp":
		return ext
	default:
		return ""
	}
}

func ensureDir(dir string) error {
	if _, err := os.Stat(dir); err == nil {
		return nil
	}
	return os.MkdirAll(dir, 0755)
}

func createFile(path string) (*os.File, error) {
	return os.Create(path)
}
