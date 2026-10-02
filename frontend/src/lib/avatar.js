// ─── AVATAR ──────────────────────────────────────────────────
//
// O avatar é salvo pelo backend em /avatars/<uuid>.<ext>, mas versões
// antigas do app gravaram a URL sem esse prefixo. Normalizar aqui evita a
// imagem quebrada sem precisar reescrever o banco inteiro.
//
// Aceita tanto a URL absoluta quanto o caminho relativo que a API pode
// devolver (/avatars/x.png), então é seguro usar em qualquer lugar.

export function avatarUrl(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const scheme = trimmed.indexOf('://')
  if (scheme < 0) return trimmed // já é caminho relativo

  const rest = trimmed.slice(scheme + 3)
  const slash = rest.indexOf('/')
  if (slash < 0) return trimmed

  const host = trimmed.slice(0, scheme + 3 + slash)
  const path = rest.slice(slash)

  if (path.startsWith('/avatars/')) return trimmed
  return `${host}/avatars${path}`
}

export function initials(name) {
  const clean = String(name || '').trim()
  if (!clean) return '?'
  const parts = clean.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}