package classroom

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TopicAccessChecker struct {
	classroomRepo Repository
	topics        topic.Service
}

func NewTopicAccessChecker(r Repository, t topic.Service) *TopicAccessChecker {
	return &TopicAccessChecker{
		classroomRepo: r,
		topics:        t,
	}
}

func (ac *TopicAccessChecker) EnsureTopicAccess(ctx context.Context, userID, topicID uuid.UUID) error {
	t, err := ac.topics.Get(ctx, topicID)
	if err != nil {
		return err
	}

	classrooms, err := ac.classroomRepo.ListClassroomsByMember(ctx, userID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't check classroom access", err)
	}

	for _, c := range classrooms {
		if c.GoalID != nil && *c.GoalID == t.GoalID {
			return nil
		}
	}

	ownedClassrooms, err := ac.classroomRepo.ListClassroomsByOwner(ctx, userID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't check classroom ownership", err)
	}

	for _, c := range ownedClassrooms {
		if c.GoalID != nil && *c.GoalID == t.GoalID {
			return nil
		}
	}

	return apperrors.NewAppError(apperrors.ErrForbidden, "you don't have access to this topic", nil)
}
