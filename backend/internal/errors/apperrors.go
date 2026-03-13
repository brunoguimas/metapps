package apperrors

import (
	"errors"
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
	case ErrInvalidToken:
		return http.StatusUnauthorized
	default:
		return 500
	}
}
