// ─── REVEAL ON SCROLL (hook) ────────────────────────────────────────
//
// Observa o elemento e devolve `true` (uma vez só) quando ele entra na
// viewport. Fica em arquivo próprio (e não junto do componente Reveal)
// para o fast refresh do Vite continuar funcionando.

import { useEffect, useRef, useState } from 'react'

export function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true)
          obs.disconnect()
        }
      },
      { threshold }
    )

    obs.observe(el)

    return () => obs.disconnect()
  }, [threshold])

  return [ref, on]
}
