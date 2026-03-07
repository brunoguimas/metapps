package jobs

import (
	"context"
	"log"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
)

func RefreshTokensCleanup(c context.Context, q db.Queries, i time.Duration) {
	ticker := time.NewTicker(i)
	defer ticker.Stop()

	for {
		select {
		case <-c.Done():
			return
		case <-ticker.C:
			if err := q.RefreshTokenCleanup(c); err != nil {
				log.Println("token cleanup failed")
			}
		}
	}
}
