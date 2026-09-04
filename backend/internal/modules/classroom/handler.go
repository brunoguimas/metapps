package classroom

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc Service
}

func NewHandler(s Service) *Handler {
	return &Handler{svc: s}
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req CreateClassroomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	classroom, err := h.svc.CreateClassroom(c.Request.Context(), userID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{"classroom": classroom})
}

func (h *Handler) List(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classrooms, err := h.svc.ListClassrooms(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"classrooms": classrooms})
}

func (h *Handler) Get(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	classroom, err := h.svc.GetClassroom(c.Request.Context(), userID, classroomID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"classroom": classroom})
}

func (h *Handler) Update(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	var req UpdateClassroomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	classroom, err := h.svc.UpdateClassroom(c.Request.Context(), userID, classroomID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"classroom": classroom})
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	if err := h.svc.DeleteClassroom(c.Request.Context(), userID, classroomID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "classroom deleted"})
}

func (h *Handler) RegenerateInviteCode(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	classroom, err := h.svc.RegenerateInviteCode(c.Request.Context(), userID, classroomID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"classroom": classroom})
}

func (h *Handler) Join(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req JoinClassroomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	classroom, err := h.svc.JoinClassroom(c.Request.Context(), userID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"classroom": classroom})
}

func (h *Handler) Leave(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	if err := h.svc.LeaveClassroom(c.Request.Context(), userID, classroomID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "left classroom"})
}

func (h *Handler) ListMembers(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	members, err := h.svc.ListMembers(c.Request.Context(), userID, classroomID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"members": members})
}

func (h *Handler) RemoveMember(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	memberID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid member id", err))
		return
	}

	if err := h.svc.RemoveMember(c.Request.Context(), userID, classroomID, memberID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "member removed"})
}

func (h *Handler) CreateAssignment(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	var req CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	assignment, err := h.svc.CreateAssignment(c.Request.Context(), userID, classroomID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{"assignment": assignment})
}

func (h *Handler) ListAssignments(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	classroomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid classroom id", err))
		return
	}

	assignments, err := h.svc.ListAssignments(c.Request.Context(), userID, classroomID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"assignments": assignments})
}

func (h *Handler) UpdateAssignment(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	assignmentID, err := uuid.Parse(c.Param("aId"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid assignment id", err))
		return
	}

	var req UpdateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	assignment, err := h.svc.UpdateAssignment(c.Request.Context(), userID, assignmentID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"assignment": assignment})
}

func (h *Handler) DeleteAssignment(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	assignmentID, err := uuid.Parse(c.Param("aId"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid assignment id", err))
		return
	}

	if err := h.svc.DeleteAssignment(c.Request.Context(), userID, assignmentID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "assignment deleted"})
}
