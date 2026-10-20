import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyStoredTheme } from './theme'

// Precisa rodar antes do render: se o tema só fosse aplicado pelo React,
// a página apareceria por um instante na paleta errada.
applyStoredTheme()

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Service workers persistem por origem: se uma build de produção já
    // rodou na mesma porta (ex.: vite preview), o SW velho passa a
    // controlar o dev server e serve bundle/cache antigos — inclusive no
    // retorno do login com Google, quebrando o fluxo. Em dev, removemos
    // qualquer SW órfão no carregamento.
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
    })
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
