package apperrors

import (
	"errors"
	"net/http"
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
	ErrGoalAlreadyExists         Code = "GOAL_ALREADY_EXISTS"
	ErrTaskNotFound              Code = "TASK_NOT_FOUND"
	ErrTaskAttemptNotFound       Code = "TASK_ATTEMPT_NOT_FOUND"
	ErrTaskAttemptTypeMismatch   Code = "TASK_ATTEMPT_TYPE_MISMATCH"
	ErrDuplicateQuestionAnswer   Code = "DUPLICATE_QUESTION_ANSWER"
	ErrInvalidQuestionIndex      Code = "INVALID_QUESTION_INDEX"
	ErrEmptyEssayResponse        Code = "EMPTY_ESSAY_RESPONSE"
	ErrPasswordTooCommon         Code = "TOO_COMMON_PASSWORD"
	ErrPasswordTooShort          Code = "PASSWORD_TOO_SHORT"
	ErrQuestionTooShort          Code = "QUESTION_TOO_SHORT"
	ErrInvalidAnswerIndex        Code = "INVALID_ANSWER_INDEX"
	ErrUnknownTaskType           Code = "UNKNOWN_TASK_TYPE"
	ErrInvalidAIResponse         Code = "INVALID_AI_RESPONSE"
	ErrTaskCorrectionNotFound    Code = "TASK_CORRECTION_NOT_FOUND"
	ErrUnauthorized              Code = "UNAUTHORIZED"
	ErrForbidden                 Code = "FORBIDDEN"
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
	return appError{
		status:  StatusFromCode(code),
		code:    code,
		message: message,
		err:     err,
	}
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
	case ErrEmptyEssayResponse:
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
	case ErrTaskCorrectionNotFound:
		return http.StatusNotFound
	case ErrUnauthorized:
		return http.StatusUnauthorized
	case ErrForbidden:
		return http.StatusForbidden
	default:
		return 500
	}
}
