// ─── CARD "HOJE" ──────────────────────────────────────────────────────
//
// Resumo do dia no estilo Duolingo: anel da meta diária de XP, chama
// da streak com o número de dias seguidos e atalhos para Treino e
// Revisão.
//
// A chamada do botão de revisão mostra o contador de exercícios
// vencidos — é o que convida o usuário a voltar.

export default function TodayCard({ daily, profile, onPractice, onReview, busy }) {
  const goal = daily?.goal_xp || profile?.daily_goal_xp || 50
  const xp = daily?.xp || 0
  const pct = goal > 0 ? Math.min(100, Math.round((xp / goal) * 100)) : 0
  const streak = daily?.streak ?? profile?.streak ?? 0
  const activeToday = daily?.streak_active_today ?? false
  const reviewDue = daily?.review_due || 0
  const reached = xp >= goal

  return (
    <section className="mp-card mp-card--pad mp-today">
      <div className="mp-today__ring">
        <svg viewBox="0 0 120 120" className="mp-today__svg" aria-hidden>
          <circle cx="60" cy="60" r="52" className="mp-today__track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className="mp-today__fill"
            strokeDasharray={`${(pct / 100) * 326.7} 326.7`}
          />
        </svg>
        <div className="mp-today__center">
          <b>{xp}</b>
          <small>/ {goal} XP</small>
        </div>
      </div>

      <div className="mp-today__body">
        <div className="mp-today__head">
          <h3 className="mp-h" style={{ margin: 0 }}>Meta de hoje</h3>
          {reached && <span className="mp-today__done">Concluída ✓</span>}
        </div>

        <p className="mp-muted" style={{ margin: '4px 0 0' }}>
          {reached
            ? 'Você bateu sua meta. Qualquer exercício extra é bônus.'
            : `Faltam ${Math.max(0, goal - xp)} XP para bater sua meta.`}
        </p>

        <div className="mp-today__streak" title="Dias seguidos de estudo">
          <span className="mp-today__flame">🔥</span>
          <b>{streak}</b>
          <span className="mp-muted">
            {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </span>
          {activeToday && <span className="mp-today__today">hoje ✓</span>}
        </div>

        <div className="mp-today__actions">
          <button
            type="button"
            className="mp-btn mp-btn--quiet"
            onClick={onPractice}
            disabled={busy}
          >
            Treino
          </button>
          <button
            type="button"
            className="mp-btn mp-btn--quiet"
            onClick={onReview}
            disabled={busy || reviewDue === 0}
          >
            Revisão{reviewDue > 0 ? ` (${reviewDue})` : ''}
          </button>
        </div>
      </div>
    </section>
  )
}
