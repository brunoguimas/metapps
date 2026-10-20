// ─── FEEDBACK INSTANTÂNEO ────────────────────────────────────────────
//
// Aparece logo abaixo do exercício, depois que o usuário verifica a
// resposta: verde quando acertou, vermelho quando errou, sempre com a
// explicação (é ela que transforma o erro em aprendizado).

export default function FeedbackPanel({ feedback, xp, combo, onContinue, isLast, busy }) {
  if (!feedback) return null

  const correct = Boolean(feedback.correct)
  const alternatives = feedback.alternatives || []

  return (
    <div
      className={`lp-feedback ${correct ? 'is-ok' : 'is-bad'}`}
      role="status"
      aria-live="polite"
    >
      <div className="lp-feedback__head">
        <span className="lp-feedback__badge">{correct ? 'Correto!' : 'Quase!'}</span>
        <span className="lp-feedback__xp">
          {xp > 0 ? `+${xp} XP` : xp < 0 ? `${xp} XP` : ''}
        </span>
        {combo > 1 && <span className="lp-feedback__combo">Combo ×{combo}</span>}
      </div>

      <p className="lp-feedback__text">
        {correct
          ? 'Boa! Você acertou.'
          : `A resposta certa era "${alternatives[feedback.correct_answer] ?? '—'}".`}
      </p>

      {feedback.explanation && (
        <p className="lp-feedback__explain">{feedback.explanation}</p>
      )}

      {feedback.hint && !correct && (
        <p className="lp-feedback__hint">Dica: {feedback.hint}</p>
      )}

      <button
        type="button"
        className="lp-feedback__btn"
        onClick={onContinue}
        disabled={busy}
      >
        {isLast ? 'Ver resultado' : 'Continuar'}
      </button>
    </div>
  )
}
