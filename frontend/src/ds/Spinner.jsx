// ─── SPINNER DO DESIGN SYSTEM ───────────────────────────────────────
//
// Um único spinner para toda a app (antes havia 4 cópias locais:
// Homepage, HistoryPage, AuthModal e o interno do Button).

export default function Spinner({ size = 15, stroke = 3, style }) {
  return (
    <svg className="ds-spinner" width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth={stroke} />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}
