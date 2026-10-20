// ─── CABEÇALHO DE SEÇÃO DO DESIGN SYSTEM ────────────────────────────
//
// O "eyebrow" da landpage (12px / 800 / uppercase / tracking largo)
// como componente: ícone opcional à esquerda, ação opcional à direita
// (ex.: "Ver tudo"). `accent` pinta de brand para seções de destaque.

export default function SectionHeader({ icon, title, action, accent = false, className = '', style }) {
  return (
    <div className={`ds-h${accent ? ' ds-h--accent' : ''}${className ? ` ${className}` : ''}`} style={style}>
      {icon}
      <span>{title}</span>
      {action && <span className="ds-h__action">{action}</span>}
    </div>
  )
}
