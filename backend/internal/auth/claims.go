package auth

import "github.com/golang-jwt/jwt/v5"

// TODO: tirar o ID
type Claims struct {
	ID string `json:"id"`
	jwt.RegisteredClaims
}
