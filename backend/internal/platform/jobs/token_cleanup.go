package jobs

import (
	"context"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
)

func RefreshTokensCleanup(c context.Context, q db.Queries, i time.Duration) {
	ticker := time.NewTicker(i)
	defer ticker.Stop()

	for {
		select {
		case <-c.Done():
			platformlogger.LogSystemInfo("refresh token cleanup stopped")
			return
		case <-ticker.C:
			if err := q.RefreshTokenCleanup(c); err != nil {
				platformlogger.LogSystemError("token cleanup failed", err)
				continue
			}

			platformlogger.LogSystemInfo("token cleanup executed")
		}
	}
}
