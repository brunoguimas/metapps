// ─── CARD DO DESIGN SYSTEM ──────────────────────────────────────────
//
// Superfície padrão da aplicação: borda fina + sombra difusa (estilo
// landpage). `interactive` adiciona o hover de elevação usado nos cards
// clicáveis (trilhas, lições, atalhos).

export default function Card({
  pad = false,
  flat = false,
  interactive = false,
  as = 'div',
  className = '',
  style,
  children,
  ...rest
}) {
  const Tag = as

  const cls = [
    'ds-card',
    pad && 'ds-card--pad',
    flat && 'ds-card--flat',
    interactive && 'ds-card--interactive',
    className,
  ].filter(Boolean).join(' ')

  return (
    <Tag className={cls} style={style} {...rest}>
      {children}
    </Tag>
  )
}
