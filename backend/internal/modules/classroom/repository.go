package classroom

import (
	"context"
	"database/sql"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	CreateClassroom(ctx context.Context, ownerID uuid.UUID, req *CreateClassroomRequest, inviteCode string) (*Classroom, error)
	GetClassroomByID(ctx context.Context, id uuid.UUID) (*Classroom, error)
	ListClassroomsByOwner(ctx context.Context, ownerID uuid.UUID) ([]*Classroom, error)
	ListClassroomsByMember(ctx context.Context, userID uuid.UUID) ([]*Classroom, error)
	UpdateClassroom(ctx context.Context, id uuid.UUID, req *UpdateClassroomRequest) (*Classroom, error)
	UpdateClassroomGoal(ctx context.Context, id uuid.UUID, goalID *uuid.UUID) (*Classroom, error)
	DeleteClassroom(ctx context.Context, id uuid.UUID) error
	GetClassroomByInviteCode(ctx context.Context, inviteCode string) (*Classroom, error)

	AddMembership(ctx context.Context, classroomID, userID uuid.UUID, role string) (*Membership, error)
	GetMembership(ctx context.Context, classroomID, userID uuid.UUID) (*Membership, error)
	ListMemberships(ctx context.Context, classroomID uuid.UUID) ([]*MemberInfo, error)
	UpdateMembershipStatus(ctx context.Context, id uuid.UUID, status string) (*Membership, error)

	CreateAssignment(ctx context.Context, classroomID, createdBy uuid.UUID, req *CreateAssignmentRequest) (*Assignment, error)
	GetAssignmentByID(ctx context.Context, id uuid.UUID) (*Assignment, error)
	ListAssignmentsByClassroom(ctx context.Context, classroomID uuid.UUID) ([]*Assignment, error)
	UpdateAssignment(ctx context.Context, id uuid.UUID, req *UpdateAssignmentRequest) (*Assignment, error)
	DeleteAssignment(ctx context.Context, id uuid.UUID) error
}

type classroomRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &classroomRepository{queries: q}
}

func (r *classroomRepository) CreateClassroom(ctx context.Context, ownerID uuid.UUID, req *CreateClassroomRequest, inviteCode string) (*Classroom, error) {
	c, err := r.queries.CreateClassroom(ctx, db.CreateClassroomParams{
		OwnerID:     ownerID,
		Name:        req.Name,
		Description: req.Description,
		InviteCode:  inviteCode,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create classroom", err)
	}

	classroom := mapClassroom(c)

	if req.GoalID != nil {
		updated, err := r.queries.UpdateClassroomGoal(ctx, db.UpdateClassroomGoalParams{
			ID:     c.ID,
			GoalID: uuid.NullUUID{UUID: *req.GoalID, Valid: true},
		})
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't set classroom goal", err)
		}
		classroom = mapClassroom(updated)
	}

	return classroom, nil
}

func (r *classroomRepository) GetClassroomByID(ctx context.Context, id uuid.UUID) (*Classroom, error) {
	c, err := r.queries.GetClassroomByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrClassroomNotFound, "classroom not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get classroom", err)
	}
	return mapClassroom(c), nil
}

func (r *classroomRepository) ListClassroomsByOwner(ctx context.Context, ownerID uuid.UUID) ([]*Classroom, error) {
	classrooms, err := r.queries.ListClassroomsByOwner(ctx, ownerID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list classrooms", err)
	}
	return mapClassrooms(classrooms), nil
}

func (r *classroomRepository) ListClassroomsByMember(ctx context.Context, userID uuid.UUID) ([]*Classroom, error) {
	classrooms, err := r.queries.ListClassroomsByMember(ctx, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list classrooms", err)
	}
	return mapClassrooms(classrooms), nil
}

func (r *classroomRepository) UpdateClassroom(ctx context.Context, id uuid.UUID, req *UpdateClassroomRequest) (*Classroom, error) {
	c, err := r.queries.UpdateClassroom(ctx, db.UpdateClassroomParams{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrClassroomNotFound, "classroom not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update classroom", err)
	}
	return mapClassroom(c), nil
}

func (r *classroomRepository) UpdateClassroomGoal(ctx context.Context, id uuid.UUID, goalID *uuid.UUID) (*Classroom, error) {
	var nullGoalID uuid.NullUUID
	if goalID != nil {
		nullGoalID = uuid.NullUUID{UUID: *goalID, Valid: true}
	}
	c, err := r.queries.UpdateClassroomGoal(ctx, db.UpdateClassroomGoalParams{
		ID:     id,
		GoalID: nullGoalID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrClassroomNotFound, "classroom not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update classroom goal", err)
	}
	return mapClassroom(c), nil
}

func (r *classroomRepository) DeleteClassroom(ctx context.Context, id uuid.UUID) error {
	err := r.queries.DeleteClassroom(ctx, id)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete classroom", err)
	}
	return nil
}

func (r *classroomRepository) GetClassroomByInviteCode(ctx context.Context, inviteCode string) (*Classroom, error) {
	c, err := r.queries.GetClassroomByInviteCode(ctx, inviteCode)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidInviteCode, "invalid or expired invite code", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get classroom by invite code", err)
	}
	return mapClassroom(c), nil
}

func (r *classroomRepository) AddMembership(ctx context.Context, classroomID, userID uuid.UUID, role string) (*Membership, error) {
	now := sql.NullTime{Time: time.Now(), Valid: true}
	m, err := r.queries.AddClassroomMembership(ctx, db.AddClassroomMembershipParams{
		ClassroomID: classroomID,
		UserID:      userID,
		RoleInClass: role,
		Status:      "active",
		JoinedAt:    now,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't add membership", err)
	}
	return mapMembership(m), nil
}

func (r *classroomRepository) GetMembership(ctx context.Context, classroomID, userID uuid.UUID) (*Membership, error) {
	m, err := r.queries.GetMembershipByClassroomAndUser(ctx, db.GetMembershipByClassroomAndUserParams{
		ClassroomID: classroomID,
		UserID:      userID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrNotClassroomMember, "not a classroom member", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get membership", err)
	}
	return mapMembership(m), nil
}

func (r *classroomRepository) ListMemberships(ctx context.Context, classroomID uuid.UUID) ([]*MemberInfo, error) {
	rows, err := r.queries.ListMembershipsByClassroom(ctx, classroomID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list memberships", err)
	}
	return mapMemberInfos(rows), nil
}

func (r *classroomRepository) UpdateMembershipStatus(ctx context.Context, id uuid.UUID, status string) (*Membership, error) {
	m, err := r.queries.UpdateMembershipStatus(ctx, db.UpdateMembershipStatusParams{
		ID:     id,
		Status: status,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrNotClassroomMember, "membership not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update membership", err)
	}
	return mapMembership(m), nil
}

func (r *classroomRepository) CreateAssignment(ctx context.Context, classroomID, createdBy uuid.UUID, req *CreateAssignmentRequest) (*Assignment, error) {
	a, err := r.queries.CreateAssignment(ctx, db.CreateAssignmentParams{
		ClassroomID: classroomID,
		Title:       req.Title,
		Description: req.Description,
		CreatedBy:   createdBy,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create assignment", err)
	}

	assignment := mapAssignment(a)

	if req.GoalID != nil {
		updated, err := r.queries.UpdateAssignment(ctx, db.UpdateAssignmentParams{
			ID:          a.ID,
			Title:       req.Title,
			Description: req.Description,
			GoalID:      uuid.NullUUID{UUID: *req.GoalID, Valid: true},
		})
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't set assignment goal", err)
		}
		assignment = mapAssignment(updated)
	}

	return assignment, nil
}

func (r *classroomRepository) GetAssignmentByID(ctx context.Context, id uuid.UUID) (*Assignment, error) {
	a, err := r.queries.GetAssignmentByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "assignment not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get assignment", err)
	}
	return mapAssignment(a), nil
}

func (r *classroomRepository) ListAssignmentsByClassroom(ctx context.Context, classroomID uuid.UUID) ([]*Assignment, error) {
	assignments, err := r.queries.ListAssignmentsByClassroom(ctx, classroomID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list assignments", err)
	}
	return mapAssignments(assignments), nil
}

func (r *classroomRepository) UpdateAssignment(ctx context.Context, id uuid.UUID, req *UpdateAssignmentRequest) (*Assignment, error) {
	a, err := r.queries.UpdateAssignment(ctx, db.UpdateAssignmentParams{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "assignment not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update assignment", err)
	}

	assignment := mapAssignment(a)

	if req.GoalID != nil {
		updated, err := r.queries.UpdateAssignment(ctx, db.UpdateAssignmentParams{
			ID:          id,
			Title:       req.Title,
			Description: req.Description,
			GoalID:      uuid.NullUUID{UUID: *req.GoalID, Valid: true},
		})
		if err != nil {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't set assignment goal", err)
		}
		assignment = mapAssignment(updated)
	}

	return assignment, nil
}

func (r *classroomRepository) DeleteAssignment(ctx context.Context, id uuid.UUID) error {
	err := r.queries.DeleteAssignment(ctx, id)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete assignment", err)
	}
	return nil
}

func mapClassroom(c db.Classroom) *Classroom {
	var goalID *uuid.UUID
	if c.GoalID.Valid {
		goalID = &c.GoalID.UUID
	}
	return &Classroom{
		ID:          c.ID,
		OwnerID:     c.OwnerID,
		Name:        c.Name,
		Description: c.Description,
		InviteCode:  c.InviteCode,
		GoalID:      goalID,
		Status:      c.Status,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func mapClassrooms(classrooms []db.Classroom) []*Classroom {
	items := make([]*Classroom, 0, len(classrooms))
	for _, c := range classrooms {
		items = append(items, mapClassroom(c))
	}
	return items
}

func mapMembership(m db.ClassroomMembership) *Membership {
	var joinedAt *time.Time
	if m.JoinedAt.Valid {
		joinedAt = &m.JoinedAt.Time
	}
	return &Membership{
		ID:          m.ID,
		ClassroomID: m.ClassroomID,
		UserID:      m.UserID,
		RoleInClass: m.RoleInClass,
		Status:      m.Status,
		JoinedAt:    joinedAt,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

func mapMemberInfos(rows []db.ListMembershipsByClassroomRow) []*MemberInfo {
	items := make([]*MemberInfo, 0, len(rows))
	for _, r := range rows {
		var joinedAt *time.Time
		if r.JoinedAt.Valid {
			joinedAt = &r.JoinedAt.Time
		}
		items = append(items, &MemberInfo{
			Membership: Membership{
				ID:          r.ID,
				ClassroomID: r.ClassroomID,
				UserID:      r.UserID,
				RoleInClass: r.RoleInClass,
				Status:      r.Status,
				JoinedAt:    joinedAt,
				CreatedAt:   r.CreatedAt,
				UpdatedAt:   r.UpdatedAt,
			},
			Username: r.Username,
			Email:    r.Email,
		})
	}
	return items
}

func mapAssignment(a db.ClassroomAssignment) *Assignment {
	var goalID *uuid.UUID
	if a.GoalID.Valid {
		goalID = &a.GoalID.UUID
	}
	return &Assignment{
		ID:          a.ID,
		ClassroomID: a.ClassroomID,
		Title:       a.Title,
		Description: a.Description,
		GoalID:      goalID,
		CreatedBy:   a.CreatedBy,
		Status:      a.Status,
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
	}
}

func mapAssignments(assignments []db.ClassroomAssignment) []*Assignment {
	items := make([]*Assignment, 0, len(assignments))
	for _, a := range assignments {
		items = append(items, mapAssignment(a))
	}
	return items
}
