// ─── ALERTA DE ERRO DO DESIGN SYSTEM ────────────────────────────────
//
// Caixa vermelha suave com ícone, usada nos formulários e fluxos de
// erro (antes: mp-alert na Homepage, errStyle na HistoryPage e errBox
// no AuthModal — três cópias do mesmo padrão).

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5V13" />
      <path d="M12 16.2h.01" />
    </svg>
  )
}

export default function Alert({ children, style, icon = true }) {
  return (
    <div className="ds-alert" style={style} role="alert">
      {icon && <IconAlert />}
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}
