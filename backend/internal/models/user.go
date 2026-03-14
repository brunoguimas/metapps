package models

import "time"

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	Verified     bool      `json:"verified"`
	CreatedAt    time.Time `json:"created_at"`
}
