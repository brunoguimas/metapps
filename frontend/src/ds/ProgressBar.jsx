// ─── BARRA DE PROGRESSO DO DESIGN SYSTEM ────────────────────────────
//
// Fina por padrão (estilo landpage); `thick` é a versão gamificada de
// 14px usada na trilha/XP. `tone` colore o preenchimento; `gradient`
// usa o arco green → brand → violet do progresso da trilha.

const TONE_VARS = {
  brand: 'var(--lp-brand)',
  green: 'var(--lp-green)',
  yellow: 'var(--lp-orange)',
  red: 'var(--lp-red)',
  violet: 'var(--lp-violet)',
  cyan: 'var(--lp-cyan)',
}

export default function ProgressBar({ value = 0, tone = 'brand', gradient = false, thick = false, style, ...rest }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  return (
    <div
      className={`ds-progress${thick ? ' ds-progress--thick' : ''}`}
      style={style}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
    >
      <div
        className={`ds-progress__fill${gradient ? ' ds-progress__fill--gradient' : ''}`}
        style={{
          width: `${pct}%`,
          ...(gradient ? {} : { '--ds-tone': TONE_VARS[tone] || TONE_VARS.brand }),
        }}
      />
    </div>
  )
}
