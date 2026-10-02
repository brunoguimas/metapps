package social

import (
	"time"

	"github.com/google/uuid"
)

// Friend é a visão pública de um amigo. Deliberadamente não existe nenhum
// campo de goal/roadmap/topic aqui: o social mostra o que o amigo"
// conquering (nível, streak, conquistas), nunca as trilhas dele.
type Friend struct {
	ID               uuid.UUID `json:"id"`
	FriendID         uuid.UUID `json:"friend_id"`
	Username         string    `json:"username"`
	AvatarURL        string    `json:"avatar_url"`
	XP               int       `json:"xp"`
	Level            int       `json:"level"`
	Streak           int       `json:"streak"`
	LastActivityDate *string   `json:"last_activity_date"`
	AddedAt          time.Time `json:"added_at"`
	MemberSince      time.Time `json:"member_since"`
}

// LevelFromXP é o mesmo degrau de 100 XP usado pelo módulo profile.
const XPPerLevel = 100

// Level deriva o nível a partir do XP, igual profile.LevelFromXP.
func LevelFromXP(xp int) int {
	return xp/XPPerLevel + 1
}

// UserCandidate é uma suggestion da busca de amigos (o usuário que ainda
// não é amigo). Traz o mesmo nível de detalhe público do Friend.
type UserCandidate struct {
	ID        uuid.UUID `json:"id"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatar_url"`
	XP        int       `json:"xp"`
	Level     int       `json:"level"`
	Streak    int       `json:"streak"`
	IsFriend  bool      `json:"is_friend"`
}

// AddFriendRequest é o corpo de POST /protected/social/friends.
// Query aceita e-mail OU username — o usuário não precisa saber qual dos
// dois está usando.
type AddFriendRequest struct {
	Query string `json:"query" binding:"required"`
}

// SocialSummary é o cabeçalho da tela de social: quantos amigos eu tenho.
type SocialSummary struct {
	Friends int `json:"friends"`
}
