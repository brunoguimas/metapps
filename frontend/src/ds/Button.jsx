// ─── BOTÃO DO DESIGN SYSTEM ─────────────────────────────────────────
//
// Um único botão para landpage + área logada. A variante define a cor/
// intenção; `press` liga a base 3D sutil (identidade gamificada, só nos
// CTAs principais); `loading` troca o conteúdo por spinner + rótulo.

function BtnSpinner() {
  return (
    <svg className="ds-btn__spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}

export default function Button({
  variant = 'primary', // primary | danger | contrast | ghost | quiet | ghost-dark
  size,                // undefined | 'sm' | 'lg'
  press = false,       // base 3D (0 4px 0) — só CTA principal
  block = false,       // width 100%
  loading = false,
  disabled,
  type = 'button',
  className = '',
  style,
  children,
  ...rest
}) {
  const cls = [
    'ds-btn',
    variant !== 'primary' && `ds-btn--${variant}`,
    press && 'ds-btn--press',
    (size === 'sm' || size === 'lg') && `ds-btn--${size}`,
    block && 'ds-btn--block',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={cls} style={style} disabled={disabled || loading} {...rest}>
      {loading && <BtnSpinner />}
      {children}
    </button>
  )
}
