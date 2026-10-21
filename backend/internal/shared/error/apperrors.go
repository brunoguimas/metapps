package apperrors

import (
	"errors"
	"net/http"

	"github.com/lib/pq"
)

type Code string

const (
	ErrInternal                  Code = "INTERNAL_ERROR"
	ErrInvalidInput              Code = "INVALID_INPUT"
	ErrInvalidCredentials        Code = "INVALID_CREDENTIALS"
	ErrUserNotFound              Code = "USER_NOT_FOUND"
	ErrEmailAlreadyInUse         Code = "EMAIL_ALREADY_IN_USE"
	ErrUserAlreadyExists         Code = ErrEmailAlreadyInUse
	ErrInvalidToken              Code = "INVALID_TOKEN"
	ErrInvalidOrExpiredEmailCode Code = "INVALID_OR_EXPIRED_EMAIL_CODE"
	ErrGoalNotFound              Code = "GOAL_NOT_FOUND"
	ErrTopicNotFound             Code = "TOPIC_NOT_FOUND"
	ErrGoalAlreadyExists         Code = "GOAL_ALREADY_EXISTS"
	ErrTaskNotFound              Code = "TASK_NOT_FOUND"
	ErrTaskAttemptNotFound       Code = "TASK_ATTEMPT_NOT_FOUND"
	ErrTaskAttemptTypeMismatch   Code = "TASK_ATTEMPT_TYPE_MISMATCH"
	ErrDuplicateQuestionAnswer   Code = "DUPLICATE_QUESTION_ANSWER"
	ErrInvalidQuestionIndex      Code = "INVALID_QUESTION_INDEX"
	ErrPasswordTooCommon         Code = "TOO_COMMON_PASSWORD"
	ErrPasswordTooShort          Code = "PASSWORD_TOO_SHORT"
	ErrQuestionTooShort          Code = "QUESTION_TOO_SHORT"
	ErrInvalidAnswerIndex        Code = "INVALID_ANSWER_INDEX"
	ErrUnknownTaskType           Code = "UNKNOWN_TASK_TYPE"
	ErrInvalidAIResponse         Code = "INVALID_AI_RESPONSE"
	ErrUpstreamUnavailable       Code = "UPSTREAM_UNAVAILABLE"
	ErrTaskCorrectionNotFound    Code = "TASK_CORRECTION_NOT_FOUND"
	ErrFlashcardNotFound         Code = "FLASHCARD_NOT_FOUND"
	ErrFlashcardDuplicate        Code = "FLASHCARD_DUPLICATE"
	ErrUnauthorized              Code = "UNAUTHORIZED"
	ErrForbidden                 Code = "FORBIDDEN"
	ErrProfileNotFound           Code = "PROFILE_NOT_FOUND"
	ErrProfileAlreadyExists      Code = "PROFILE_ALREADY_EXISTS"
	ErrClassroomNotFound         Code = "CLASSROOM_NOT_FOUND"
	ErrClassroomAlreadyMember    Code = "CLASSROOM_ALREADY_MEMBER"
	ErrInvalidInviteCode         Code = "INVALID_INVITE_CODE"
	ErrNotClassroomMember        Code = "NOT_CLASSROOM_MEMBER"
	ErrAlreadyFriend             Code = "ALREADY_FRIEND"
	ErrNotFriend                 Code = "NOT_FRIEND"
	ErrSchemaOutOfSync           Code = "SCHEMA_OUT_OF_SYNC"
)

type appError struct {
	status  int
	code    Code
	message string
	err     error
}

type AppError interface {
	error
	Code() Code
	Status() int
	Unwrap() error
}

func NewAppError(code Code, message string, err error) error {
	// Tabela/coluna que não existe é sempre migration faltando, não bug de
	// lógica. Promover a ErrInternal genérica para um código próprio evita o
	// 500 "internal server error" sem pista que esse erro produzia.
	if code == ErrInternal && isMissingSchema(err) {
		return appError{
			status:  StatusFromCode(ErrSchemaOutOfSync),
			code:    ErrSchemaOutOfSync,
			message: "database schema is out of sync with the code: a migration is missing",
			err:     err,
		}
	}

	return appError{
		status:  StatusFromCode(code),
		code:    code,
		message: message,
		err:     err,
	}
}

// isMissingSchema detecta os códigos SQLSTATE do Postgres que significam
// "esse objeto não está no banco".
func isMissingSchema(err error) bool {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return false
	}

	switch pqErr.Code {
	case "42P01", // undefined_table
		"42703", // undefined_column
		"3F000", // invalid_schema_name
		"42P07": // duplicate_table (migration partially applied)
		return true
	}
	return false
}
func (e appError) Error() string {
	return e.message
}

func (e appError) Code() Code {
	return e.code
}

func (e appError) Status() int {
	return e.status
}

func (e appError) Unwrap() error {
	return e.err
}

func As(err error) (AppError, bool) {
	var appErr AppError
	if errors.As(err, &appErr) {
		return appErr, true
	}

	return nil, false
}

func StatusFromCode(code Code) int {
	switch code {
	case ErrInternal:
		return http.StatusInternalServerError
	case ErrSchemaOutOfSync:
		return http.StatusInternalServerError
	case ErrInvalidInput:
		return http.StatusBadRequest
	case ErrInvalidCredentials:
		return http.StatusUnauthorized
	case ErrUserNotFound:
		return http.StatusNotFound
	case ErrEmailAlreadyInUse:
		return http.StatusConflict
	case ErrInvalidToken:
		return http.StatusUnauthorized
	case ErrInvalidOrExpiredEmailCode:
		return http.StatusBadRequest
	case ErrGoalNotFound:
		return http.StatusNotFound
	case ErrTopicNotFound:
		return http.StatusNotFound
	case ErrGoalAlreadyExists:
		return http.StatusConflict
	case ErrTaskNotFound:
		return http.StatusNotFound
	case ErrTaskAttemptNotFound:
		return http.StatusNotFound
	case ErrTaskAttemptTypeMismatch:
		return http.StatusBadRequest
	case ErrDuplicateQuestionAnswer:
		return http.StatusBadRequest
	case ErrInvalidQuestionIndex:
		return http.StatusBadRequest
	case ErrPasswordTooCommon:
		return http.StatusBadRequest
	case ErrPasswordTooShort:
		return http.StatusBadRequest
	case ErrQuestionTooShort:
		return http.StatusInternalServerError
	case ErrInvalidAnswerIndex:
		return http.StatusInternalServerError
	case ErrUnknownTaskType:
		return http.StatusInternalServerError
	case ErrInvalidAIResponse:
		return http.StatusInternalServerError
	case ErrUpstreamUnavailable:
		// O Gemini está sob carga ou fora do ar. Não é culpa da requisição:
		// 503 diz ao cliente que repetir pode funcionar, diferente do 500.
		return http.StatusServiceUnavailable
	case ErrTaskCorrectionNotFound:
		return http.StatusNotFound
	case ErrFlashcardNotFound:
		return http.StatusNotFound
	case ErrFlashcardDuplicate:
		return http.StatusConflict
	case ErrUnauthorized:
		return http.StatusUnauthorized
	case ErrForbidden:
		return http.StatusForbidden
	case ErrProfileNotFound:
		return http.StatusNotFound
	case ErrProfileAlreadyExists:
		return http.StatusConflict
	case ErrClassroomNotFound:
		return http.StatusNotFound
	case ErrClassroomAlreadyMember:
		return http.StatusConflict
	case ErrInvalidInviteCode:
		return http.StatusBadRequest
	case ErrNotClassroomMember:
		return http.StatusForbidden
	case ErrAlreadyFriend:
		return http.StatusConflict
	case ErrNotFriend:
		return http.StatusNotFound
	default:
		return 500
	}
}
