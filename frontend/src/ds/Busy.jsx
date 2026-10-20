// ─── BLOCO DE ESPERA DO DESIGN SYSTEM ───────────────────────────────
//
// Algumas ações do app demoram: a IA monta a trilha e a atividade
// antes de devolver qualquer coisa. Sem uma espera visível o usuário
// acha que a tela travou — e clica de novo.
//
// Todo processo longo mostra este bloco: três pontinhos pulsando, o
// que está acontecendo e uma dica de quanto tempo costuma levar.

export default function Busy({ title, hint, className = '', style }) {
  return (
    <div
      className={`ds-busy ${className}`.trim()}
      style={style}
      role="status"
      aria-live="polite"
    >
      <span className="ds-busy__dots" aria-hidden="true">
        <i /><i /><i />
      </span>

      <span className="ds-busy__text">
        <b className="ds-busy__title">{title}</b>
        {hint && <span className="ds-busy__hint">{hint}</span>}
      </span>
    </div>
  )
}
