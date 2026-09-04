package classroom

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	CreateClassroom(ctx context.Context, ownerID uuid.UUID, req *CreateClassroomRequest) (*Classroom, error)
	GetClassroom(ctx context.Context, userID, classroomID uuid.UUID) (*Classroom, error)
	ListClassrooms(ctx context.Context, userID uuid.UUID) ([]*Classroom, error)
	UpdateClassroom(ctx context.Context, userID, classroomID uuid.UUID, req *UpdateClassroomRequest) (*Classroom, error)
	DeleteClassroom(ctx context.Context, userID, classroomID uuid.UUID) error
	RegenerateInviteCode(ctx context.Context, userID, classroomID uuid.UUID) (*Classroom, error)
	JoinClassroom(ctx context.Context, userID uuid.UUID, req *JoinClassroomRequest) (*Classroom, error)
	LeaveClassroom(ctx context.Context, userID, classroomID uuid.UUID) error
	ListMembers(ctx context.Context, userID, classroomID uuid.UUID) ([]*MemberInfo, error)
	RemoveMember(ctx context.Context, ownerID, classroomID, memberID uuid.UUID) error

	CreateAssignment(ctx context.Context, userID, classroomID uuid.UUID, req *CreateAssignmentRequest) (*Assignment, error)
	ListAssignments(ctx context.Context, userID, classroomID uuid.UUID) ([]*Assignment, error)
	UpdateAssignment(ctx context.Context, userID, assignmentID uuid.UUID, req *UpdateAssignmentRequest) (*Assignment, error)
	DeleteAssignment(ctx context.Context, userID, assignmentID uuid.UUID) error

	EnsureClassroomAccess(ctx context.Context, userID, classroomID uuid.UUID) error
	EnsureClassroomOwner(ctx context.Context, userID, classroomID uuid.UUID) error
}

type classroomService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &classroomService{repo: r}
}

func generateInviteCode() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *classroomService) CreateClassroom(ctx context.Context, ownerID uuid.UUID, req *CreateClassroomRequest) (*Classroom, error) {
	code, err := generateInviteCode()
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't generate invite code", err)
	}

	classroom, err := s.repo.CreateClassroom(ctx, ownerID, req, code)
	if err != nil {
		return nil, err
	}

	_, err = s.repo.AddMembership(ctx, classroom.ID, ownerID, "teacher")
	if err != nil {
		return nil, err
	}

	return classroom, nil
}

func (s *classroomService) GetClassroom(ctx context.Context, userID, classroomID uuid.UUID) (*Classroom, error) {
	if err := s.EnsureClassroomAccess(ctx, userID, classroomID); err != nil {
		return nil, err
	}
	return s.repo.GetClassroomByID(ctx, classroomID)
}

func (s *classroomService) ListClassrooms(ctx context.Context, userID uuid.UUID) ([]*Classroom, error) {
	owned, err := s.repo.ListClassroomsByOwner(ctx, userID)
	if err != nil {
		return nil, err
	}

	member, err := s.repo.ListClassroomsByMember(ctx, userID)
	if err != nil {
		return nil, err
	}

	seen := make(map[uuid.UUID]bool)
	var result []*Classroom
	for _, c := range owned {
		if !seen[c.ID] {
			result = append(result, c)
			seen[c.ID] = true
		}
	}
	for _, c := range member {
		if !seen[c.ID] {
			result = append(result, c)
			seen[c.ID] = true
		}
	}

	return result, nil
}

func (s *classroomService) UpdateClassroom(ctx context.Context, userID, classroomID uuid.UUID, req *UpdateClassroomRequest) (*Classroom, error) {
	if err := s.EnsureClassroomOwner(ctx, userID, classroomID); err != nil {
		return nil, err
	}
	return s.repo.UpdateClassroom(ctx, classroomID, req)
}

func (s *classroomService) DeleteClassroom(ctx context.Context, userID, classroomID uuid.UUID) error {
	if err := s.EnsureClassroomOwner(ctx, userID, classroomID); err != nil {
		return err
	}
	return s.repo.DeleteClassroom(ctx, classroomID)
}

func (s *classroomService) RegenerateInviteCode(ctx context.Context, userID, classroomID uuid.UUID) (*Classroom, error) {
	if err := s.EnsureClassroomOwner(ctx, userID, classroomID); err != nil {
		return nil, err
	}

	code, err := generateInviteCode()
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't generate invite code", err)
	}

	classroom, err := s.repo.GetClassroomByID(ctx, classroomID)
	if err != nil {
		return nil, err
	}

	classroom.InviteCode = code
	return s.repo.UpdateClassroom(ctx, classroomID, &UpdateClassroomRequest{
		Name:        classroom.Name,
		Description: classroom.Description,
	})
}

func (s *classroomService) JoinClassroom(ctx context.Context, userID uuid.UUID, req *JoinClassroomRequest) (*Classroom, error) {
	classroom, err := s.repo.GetClassroomByInviteCode(ctx, req.InviteCode)
	if err != nil {
		return nil, err
	}

	existing, _ := s.repo.GetMembership(ctx, classroom.ID, userID)
	if existing != nil && existing.Status == "active" {
		return nil, apperrors.NewAppError(apperrors.ErrClassroomAlreadyMember, "already a member of this classroom", nil)
	}

	_, err = s.repo.AddMembership(ctx, classroom.ID, userID, "student")
	if err != nil {
		return nil, err
	}

	return classroom, nil
}

func (s *classroomService) LeaveClassroom(ctx context.Context, userID, classroomID uuid.UUID) error {
	membership, err := s.repo.GetMembership(ctx, classroomID, userID)
	if err != nil {
		return err
	}

	if membership.RoleInClass == "teacher" {
		return apperrors.NewAppError(apperrors.ErrForbidden, "teacher cannot leave classroom, transfer ownership or delete", nil)
	}

	_, err = s.repo.UpdateMembershipStatus(ctx, membership.ID, "left")
	return err
}

func (s *classroomService) ListMembers(ctx context.Context, userID, classroomID uuid.UUID) ([]*MemberInfo, error) {
	if err := s.EnsureClassroomAccess(ctx, userID, classroomID); err != nil {
		return nil, err
	}
	return s.repo.ListMemberships(ctx, classroomID)
}

func (s *classroomService) RemoveMember(ctx context.Context, ownerID, classroomID, memberID uuid.UUID) error {
	if err := s.EnsureClassroomOwner(ctx, ownerID, classroomID); err != nil {
		return err
	}

	if ownerID == memberID {
		return apperrors.NewAppError(apperrors.ErrForbidden, "cannot remove yourself from classroom", nil)
	}

	membership, err := s.repo.GetMembership(ctx, classroomID, memberID)
	if err != nil {
		return err
	}

	_, err = s.repo.UpdateMembershipStatus(ctx, membership.ID, "left")
	return err
}

func (s *classroomService) CreateAssignment(ctx context.Context, userID, classroomID uuid.UUID, req *CreateAssignmentRequest) (*Assignment, error) {
	if err := s.EnsureClassroomOwner(ctx, userID, classroomID); err != nil {
		return nil, err
	}
	return s.repo.CreateAssignment(ctx, classroomID, userID, req)
}

func (s *classroomService) ListAssignments(ctx context.Context, userID, classroomID uuid.UUID) ([]*Assignment, error) {
	if err := s.EnsureClassroomAccess(ctx, userID, classroomID); err != nil {
		return nil, err
	}
	return s.repo.ListAssignmentsByClassroom(ctx, classroomID)
}

func (s *classroomService) UpdateAssignment(ctx context.Context, userID, assignmentID uuid.UUID, req *UpdateAssignmentRequest) (*Assignment, error) {
	assignment, err := s.repo.GetAssignmentByID(ctx, assignmentID)
	if err != nil {
		return nil, err
	}

	if err := s.EnsureClassroomOwner(ctx, userID, assignment.ClassroomID); err != nil {
		return nil, err
	}

	return s.repo.UpdateAssignment(ctx, assignmentID, req)
}

func (s *classroomService) DeleteAssignment(ctx context.Context, userID, assignmentID uuid.UUID) error {
	assignment, err := s.repo.GetAssignmentByID(ctx, assignmentID)
	if err != nil {
		return err
	}

	if err := s.EnsureClassroomOwner(ctx, userID, assignment.ClassroomID); err != nil {
		return err
	}

	return s.repo.DeleteAssignment(ctx, assignmentID)
}

func (s *classroomService) EnsureClassroomAccess(ctx context.Context, userID, classroomID uuid.UUID) error {
	classroom, err := s.repo.GetClassroomByID(ctx, classroomID)
	if err != nil {
		return err
	}

	if classroom.OwnerID == userID {
		return nil
	}

	membership, err := s.repo.GetMembership(ctx, classroomID, userID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrNotClassroomMember, "you don't have access to this classroom", err)
	}

	if membership.Status != "active" {
		return apperrors.NewAppError(apperrors.ErrNotClassroomMember, "your membership is not active", nil)
	}

	return nil
}

func (s *classroomService) EnsureClassroomOwner(ctx context.Context, userID, classroomID uuid.UUID) error {
	classroom, err := s.repo.GetClassroomByID(ctx, classroomID)
	if err != nil {
		return err
	}

	if classroom.OwnerID != userID {
		return apperrors.NewAppError(apperrors.ErrForbidden, "only classroom owner can perform this action", nil)
	}

	return nil
}
