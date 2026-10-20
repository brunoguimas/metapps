// ─── CHIP / TAG DO DESIGN SYSTEM ────────────────────────────────────
//
// Pill pequena em uppercase para status e metadados (tipo de tarefa,
// "IA ATIVA", "Desbloqueada"…). O tom deriva dos tokens -d/-soft.

const TONES = ['brand', 'green', 'yellow', 'red', 'violet', 'cyan', 'neutral']

export default function Chip({ tone = 'brand', className = '', style, children, ...rest }) {
  const cls = [
    'ds-chip',
    TONES.includes(tone) && tone !== 'brand' && `ds-chip--${tone}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <span className={cls} style={style} {...rest}>
      {children}
    </span>
  )
}
