package apperrors

import (
	"net/http"
)

type Code string

const (
	ErrInternal           Code = "INTERNAL_ERROR"
	ErrInvalidInput       Code = "INVALID_INPUT"
	ErrInvalidCredentials Code = "INVALID_CREDENTIALS"
	ErrUserNotFound       Code = "USER_NOT_FOUND"
	ErrInvalidToken       Code = "INVALID_TOKEN"
)

type appError struct {
	status  int
	code    Code
	message string
	err     error
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
	case ErrInvalidToken:
		return http.StatusUnauthorized
	default:
		return 500
	}
}
