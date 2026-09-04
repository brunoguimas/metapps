package classroom

import (
	"time"

	"github.com/google/uuid"
)

type Classroom struct {
	ID          uuid.UUID  `json:"id"`
	OwnerID     uuid.UUID  `json:"owner_id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	InviteCode  string     `json:"invite_code"`
	GoalID      *uuid.UUID `json:"goal_id,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Membership struct {
	ID          uuid.UUID  `json:"id"`
	ClassroomID uuid.UUID  `json:"classroom_id"`
	UserID      uuid.UUID  `json:"user_id"`
	RoleInClass string     `json:"role_in_class"`
	Status      string     `json:"status"`
	JoinedAt    *time.Time `json:"joined_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type MemberInfo struct {
	Membership
	Username string `json:"username"`
	Email    string `json:"email"`
}

type Assignment struct {
	ID          uuid.UUID  `json:"id"`
	ClassroomID uuid.UUID  `json:"classroom_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	GoalID      *uuid.UUID `json:"goal_id,omitempty"`
	CreatedBy   uuid.UUID  `json:"created_by"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type CreateClassroomRequest struct {
	Name        string     `json:"name" binding:"required"`
	Description string     `json:"description"`
	GoalID      *uuid.UUID `json:"goal_id,omitempty"`
}

type UpdateClassroomRequest struct {
	Name        string     `json:"name" binding:"required"`
	Description string     `json:"description"`
}

type JoinClassroomRequest struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

type CreateAssignmentRequest struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	GoalID      *uuid.UUID `json:"goal_id,omitempty"`
}

type UpdateAssignmentRequest struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	GoalID      *uuid.UUID `json:"goal_id,omitempty"`
}
