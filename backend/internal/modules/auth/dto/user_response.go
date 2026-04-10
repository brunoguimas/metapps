package dto

import "github.com/google/uuid"

type UserResponse struct {
	ID       uuid.UUID
	Username string
	Email    string
}
