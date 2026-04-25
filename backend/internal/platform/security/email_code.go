package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func GenerateOTP() (string, error) {
	b := make([]byte, 3)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	n := int(b[0])<<16 | int(b[1])<<8 | int(b[2])
	code := n % 1000000

	return fmt.Sprintf("%06d", code), nil
}

func HashValue(value string) string {
	hash := sha256.Sum256([]byte(value))
	return hex.EncodeToString(hash[:])
}
