// ─── NOTIFICAÇÕES ────────────────────────────────────────────
//
// Não existe tabela de notificações no backend, então o sino monta a
// lista a partir do que mudou na conta do usuário:
//   - conquistas que foram desbloqueadas;
//   - marcos de sequência de dias;
//   - amigos na sua lista.
//
// A lista fica em localStorage: sobrevive ao reload, e o "lido" também.
// Todos os eventos são monotônicos (conquista não volta a travar, marco de
// streak não some), então um id estável por evento basta para nunca
// duplicar.
//
// mergeNotifications é puro de propósito: a gravação fica em
// persistNotifications, chamada num efeito.

import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'metapps:notifications'
const MAX_ITEMS = 30

export function readNotifications() {
  return readJSON(STORAGE_KEY, [])
}

export function persistNotifications(list) {
  writeJSON(STORAGE_KEY, list)
  return list
}

// Junta os eventos derivados com o que já estava guardado. Só o que é novo
// entra como não lido, e a lista é limitada para não crescer sem fim.
export function mergeNotifications(stored, events) {
  const seen = new Set(stored.map(n => n.id))

  const fresh = (events || [])
    .filter(e => e && e.id && !seen.has(e.id))
    .map(e => ({ ...e, read: false, at: new Date().toISOString() }))

  if (fresh.length === 0) return stored
  return [...fresh, ...stored].slice(0, MAX_ITEMS)
}

export function markAllRead(list) {
  return (list || []).map(n => (n.read ? n : { ...n, read: true }))
}

export function unreadCount(notifications) {
  return (notifications || []).filter(n => !n.read).length
}

// ─── EVENTOS ─────────────────────────────────────────────────

// Conquistas: id estável, porque desbloquear acontece uma única vez.
export function achievementEvents(achievements) {
  return (achievements || [])
    .filter(a => a.unlocked)
    .map(a => ({
      id: `ach:${a.id}`,
      kind: 'achievement',
      tone: a.tone,
      title: 'Conquista desbloqueada',
      body: a.title,
    }))
}

// Marcos de sequência: a sequência só cresce, então avisar uma vez basta.
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]

export function streakEvents(bestStreak) {
  return STREAK_MILESTONES
    .filter(m => bestStreak >= m)
    .map(m => ({
      id: `streak:${m}`,
      kind: 'streak',
      tone: 'amber',
      title: `${m} dias seguidos`,
      body: 'Seu ritmo de estudos está firme. Continue assim.',
    }))
}

// Amigos.
export function friendEvents(friends) {
  return (friends || []).map(f => ({
    id: `friend:${f.friend_id}`,
    kind: 'friend',
    tone: 'cyan',
    title: 'Amigo na sua lista',
    body: f.username,
  }))
}