// ─── REVEAL ON SCROLL ───────────────────────────────────────────────
//
// Movido da Landpage: fade + translateY quando o elemento entra na
// viewport. O hook vive em useReveal.js (arquivo separado por causa da
// regra de fast refresh: um arquivo só exporta componentes).

import { useReveal } from './useReveal'

export function Reveal({ children, delay = 0, style: custom }) {
  const [ref, on] = useReveal()

  return (
    <div
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'translateY(0)' : 'translateY(28px)',
        transition: `
          opacity 0.65s ease ${delay}ms,
          transform 0.65s ease ${delay}ms
        `,
        ...custom
      }}
    >
      {children}
    </div>
  )
}
