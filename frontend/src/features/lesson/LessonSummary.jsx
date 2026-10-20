// ─── RESUMO DA SESSÃO ─────────────────────────────────────────────────
//
// Tela final da sessão: anel de score, XP ganho, combo máximo e o que
// aconteceu com o tópico. É o "final feliz" do Duolingo — com a opção
// de refazer só os exercícios errados.

export default function LessonSummary({ result, task, correction, correctionLoading, onRetry, onNext }) {
  const score = Math.round((result?.score || 0) * 100)
  const perfect = Boolean(result?.perfect)
  const mastered = Boolean(result?.mastered)
  const total = result?.total_questions || 0
  const correct = result?.correct_answers || 0
  const wrong = Array.isArray(result?.wrong_steps) ? result.wrong_steps : []
  const tone = score >= 100 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="lp-wrap lp-wrap--summary">
      <div className="lp-summary">
        <div className="lp-summary__badge" style={{ borderColor: tone }}>
          <div className="lp-summary__ring" style={{ color: tone }}>
            <b>{score}%</b>
            <small>{correct}/{total}</small>
          </div>
        </div>

        <h2 className="lp-summary__title">
          {perfect
            ? 'Perfeito!'
            : mastered
              ? 'Tópico dominado!'
              : score >= 60
                ? 'Bom trabalho!'
                : 'Vamos revisar isso?'}
        </h2>

        {task?.meta?.title && (
          <p className="lp-summary__session">{task.meta.title}</p>
        )}

        <p className="lp-summary__sub">
          {mastered
            ? 'Você atingiu o nível necessário para seguir na trilha.'
            : `Faltou ${Math.max(0, Math.round((result?.required_mastery || 0) * 100) - score)}% para dominar o tópico.`}
        </p>

        <div className="lp-summary__stats">
          <div className="lp-summary__stat">
            <b>+{result?.xp_gained || 0}</b>
            <small>XP</small>
          </div>
          <div className="lp-summary__stat">
            <b>{result?.max_combo || 0}</b>
            <small>combo</small>
          </div>
          <div className="lp-summary__stat">
            <b>{result?.streak || 0}</b>
            <small>dias seguidos</small>
          </div>
          <div className="lp-summary__stat">
            <b>{result?.daily_xp || 0}/{result?.daily_goal || 0}</b>
            <small>meta do dia</small>
          </div>
        </div>

        {wrong.length > 0 && (
          <div className="lp-summary__wrong">
            <b>{wrong.length} exercício{wrong.length > 1 ? 's' : ''} para revisar</b>
            <span>
              Eles já entraram na sua fila de revisão e voltam em breve.
            </span>
          </div>
        )}
        {correction && (
          <div className="lp-summary__ai">
            <b>Feedback da IA</b>
            {typeof correction === 'string'
              ? <p>{correction}</p>
              : (
                <>
                  {correction.summary && <p>{correction.summary}</p>}
                  {/* O backend devolve o texto da IA em `feedback` (string).
                      Sem este caso o bloco ficava com o título e nenhum
                      conteúdo. */}
                  {typeof correction.feedback === 'string' && correction.feedback.trim() && (
                    <p>{correction.feedback}</p>
                  )}
                  {Array.isArray(correction.feedback) && correction.feedback.map((f, i) => (
                    <p key={i}>{typeof f === 'string' ? f : (f.comment || f.explanation || '')}</p>
                  ))}
                </>
              )}
          </div>
        )}

        {!correction && correctionLoading && (
          <div className="lp-summary__ai">
            <b>Feedback da IA</b>
            <p>Gerando a análise da sua sessão…</p>
          </div>
        )}

        <div className="lp-summary__actions">
          {onRetry && (
            <button type="button" className="lp-summary__btn is-quiet" onClick={onRetry}>
              {wrong.length > 0 ? 'Refazer os errados' : 'Treinar de novo'}
            </button>
          )}
          {onNext && (
            <button type="button" className="lp-summary__btn" onClick={onNext}>
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
