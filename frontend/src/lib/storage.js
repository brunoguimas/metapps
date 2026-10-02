// ─── STORAGE SEGURO ──────────────────────────────────────────
//
// localStorage pode estar bloqueado (aba anônima, modo restrito) ou
// estourar quota. Nenhuma dessas falhas pode derrubar a tela, então todo
// acesso passa por aqui e devolve o fallback silenciosamente.

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // preferência só vive nesta sessão
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // idem
  }
}