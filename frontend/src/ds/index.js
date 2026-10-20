// ─── DESIGN SYSTEM METAPPS ──────────────────────────────────────────
//
// Barrel export: `import { Button, Card, … } from './ds'` traz também o
// CSS base (ds.css), que consome apenas tokens --lp-* do index.css.

import './ds.css'

export { default as Button } from './Button.jsx'
export { default as Busy } from './Busy.jsx'
export { default as Card } from './Card.jsx'
export { default as Chip } from './Chip.jsx'
export { default as ProgressBar } from './ProgressBar.jsx'
export { default as SectionHeader } from './SectionHeader.jsx'
export { default as Spinner } from './Spinner.jsx'
export { default as Alert } from './Alert.jsx'
export { Reveal } from './Reveal.jsx'
export { useReveal } from './useReveal.js'
