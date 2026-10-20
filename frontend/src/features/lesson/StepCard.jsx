// ─── CARTÃO DE UM EXERCÍCIO ─────────────────────────────────────────
//
// Mostra uma pergunta por vez, no estilo Duolingo: enunciado grande,
// material opcional (colapsável) e alternativas largas em forma de
// botão.
//
// O componente é "controlado": quem decide o estado visual da
// alternativa (selecionada / correta / errada) é o player, para que a
// transição de feedback fique em um lugar só.

import { useState } from 'react'
import { textMaterials } from './lessonUtils.js'

const KEY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function StepCard({
  step,
  index,
  total,
  selected,
  onSelect,
  feedback,
  disabled,
}) {
  const alternatives = Array.isArray(step?.alternatives) ? step.alternatives : []
  const materials = textMaterials(step?.material)
  // O material começa recolhido: o enunciado precisa aparecer logo.
  const [showMaterial, setShowMaterial] = useState(false)

  return (
    <div className="lp-card">
      <div className="lp-card__head">
        <span className="lp-card__num">{index + 1}</span>
        <span className="lp-card__count">de {total}</span>
        {step?.skill && <span className="lp-card__skill">{step.skill}</span>}
      </div>

      {materials.length > 0 && (
        <div className="lp-material">
          <button
            type="button"
            className="lp-material__toggle"
            onClick={() => setShowMaterial(v => !v)}
            aria-expanded={showMaterial}
          >
            {showMaterial ? 'Ocultar contexto' : 'Ver contexto'}
          </button>
          {showMaterial && materials.map((t, i) => (
            <p key={i} className="lp-material__text">{t}</p>
          ))}
        </div>
      )}

      <p className="lp-statement">{step?.statement}</p>

      <div className="lp-options" role="group" aria-label="Alternativas">
        {alternatives.map((alt, ai) => {
          const isSelected = selected === ai
          const isCorrect = feedback && ai === feedback.correct_answer
          const isWrongPick = feedback && isSelected && !feedback.correct

          const cls = [
            'lp-option',
            isSelected && 'is-selected',
            feedback && isCorrect && 'is-correct',
            isWrongPick && 'is-wrong',
          ].filter(Boolean).join(' ')

          return (
            <button
              type="button"
              key={ai}
              className={cls}
              onClick={() => onSelect(ai)}
              disabled={disabled || Boolean(feedback)}
              aria-pressed={isSelected}
            >
              <span className="lp-option__key">{KEY_LABELS[ai] || ai + 1}</span>
              <span className="lp-option__text">{alt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
