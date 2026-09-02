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

// ProfileHandler handles HTTP requests for profiles.
type ProfileHandler struct {
	service ProfileService
	cfg     *config.Config
}

// NewProfileHandler returns a new ProfileHandler.
func NewProfileHandler(service ProfileService, cfg *config.Config) *ProfileHandler {
	return &ProfileHandler{
		service: service,
		cfg:     cfg,
	}
}

// profileResponse builds a JSON-compatible representation of a profile.
func profileResponse(p *Profile) gin.H {
	return gin.H{
		"id":                 p.ID,
		"user_id":            p.UserID,
		"xp":                 p.XP,
		"streak":             p.Streak,
		"level":              p.Level(),
		"last_activity_date": p.LastActivityDate,
		"avatar_url":         p.AvatarURL,
		"created_at":         p.CreatedAt,
		"updated_at":         p.UpdatedAt,
	}
}

// GetProfile returns the profile for the currently authenticated user.
func (h *ProfileHandler) GetProfile(c *gin.Context) {
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

	httpx.OK(c, gin.H{
		"profile": profileResponse(profile),
	})
}

// AddXP adds XP to the currently authenticated user's profile.
func (h *ProfileHandler) AddXP(c *gin.Context) {
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

	httpx.OK(c, gin.H{
		"profile": profileResponse(profile),
	})
}

// UpdateAvatar handles avatar upload for the currently authenticated user.
// Expects a multipart/form-data with a file field named "avatar".
func (h *ProfileHandler) UpdateAvatar(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	// Parse the multipart form
	err = c.Request.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "failed to parse form", err))
		return
	}

	// Get the avatar file
	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "avatar file not found", err))
		return
	}
	defer file.Close()

	// Validate file type (only allow images)
	ext := GetFileExtension(header.Filename)
	if ext == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "unsupported file type (only .png, .jpg, .jpeg, .gif, .webp allowed)", nil))
		return
	}
	filename := uuid.New().String() + ext
	// Define the directory for avatars (relative to the project root)
	avatarDir := "./avatars"
	// Ensure the directory exists
	if err := ensureDir(avatarDir); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to create avatar directory", err))
		return
	}
	// Save the file
	out, err := createFile(filepath.Join(avatarDir, filename))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to save avatar", err))
		return
	}
	defer out.Close()

	// Write the file content
	if _, err := io.Copy(out, file); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "failed to write avatar", err))
		return
	}

	// Update the profile with the avatar URL
	avatarURL := h.cfg.AvatarBaseURL + "/" + filename // e.g., http://localhost:8080/avatars/filename.png
	_, err = h.service.UpdateAvatar(c.Request.Context(), userID, avatarURL)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"message":   "avatar uploaded successfully",
		"avatar_url": avatarURL,
	})
}

// helper functions for file operations
func GetFileExtension(filename string) string {
	// Return the extension (including the dot) if it's an image, otherwise empty string
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp":
		return ext
	default:
		return ""
	}
}

func ensureDir(dir string) error {
	// Check if directory exists
	if _, err := os.Stat(dir); err == nil {
		return nil
	}
	// Create directory and parents
	return os.MkdirAll(dir, 0755)
}

func createFile(path string) (*os.File, error) {
	return os.Create(path)
}