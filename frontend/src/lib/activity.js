// ─── ATIVIDADE DIÁRIA ────────────────────────────────────────
//
// O "streak" do Metapps é o número de dias seguidos em que a pessoa fez
// pelo menos UMA atividade. A fonte da verdade aqui é o histórico de
// tentativas (/protected/task-attempts): cada tentativa é uma atividade,
// então o dia é "ativo" se existir tentativa com data local igual à do
// dia.
//
// Tudo é derivado no cliente de propósito: o backend só guarda o número
// do streak, que não diz QUANDO a pessoa studied. O calendário precisa do
// dia a dia.

const DAY_MS = 86400000
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// Chave local (YYYY-MM-DD). Usa o relógio local, não UTC: quem estuda
// 22h de Monday continua em Monday, mesmo que a API devolva 01h UTC de
// Tuesday.
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey() {
  return dayKey(new Date())
}

// mapa { 'YYYY-MM-DD': quantidade de atividades }
export function activityByDay(attempts) {
  const map = {}
  for (const a of attempts || []) {
    const key = dayKey(a?.created_at)
    if (!key) continue
    map[key] = (map[key] || 0) + 1
  }
  return map
}

function shiftDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return dayKey(date)
}

// Sequência atual: conta para trás a partir de hoje. Se hoje ainda não
// teve atividade, mas ontem teve, a sequência continua valendo (o dia
// ainda não acabou) — só zera quando passou um dia inteiro sem nada.
export function currentStreak(counts) {
  const today = todayKey()
  const yesterday = shiftDays(today, -1)

  // runFrom já conta o dia em que começa, então não se soma 1 aqui.
  if (counts[today]) return runFrom(counts, today, -1)
  if (counts[yesterday]) return runFrom(counts, yesterday, -1)
  return 0
}

function runFrom(counts, fromKey, step) {
  let n = 0
  let key = fromKey
  while (counts[key]) {
    n += 1
    key = shiftDays(key, step)
  }
  return n
}

// Maior sequência de dias consecutivos já registrada.
export function longestStreak(counts) {
  const keys = Object.keys(counts)
    .filter(k => counts[k] > 0)
    .sort()
  if (keys.length === 0) return 0

  let best = 1
  let run = 1
  for (let i = 1; i < keys.length; i += 1) {
    run = shiftDays(keys[i - 1], 1) === keys[i] ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

export function activeDays(counts) {
  return Object.keys(counts).filter(k => counts[k] > 0).length
}

// Grade de semanas para o calendário: cada semana é um array de 7 dias
// (domingo → sábado), terminando na semana atual.
export function buildCalendar(counts, weeks = 12) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Domingo da semana atual.
  const firstOfLastWeek = new Date(now)
  firstOfLastWeek.setDate(firstOfLastWeek.getDate() - firstOfLastWeek.getDay() - (weeks - 1) * 7)

  const total = weeks * 7
  const days = new Array(total)

  for (let i = 0; i < total; i += 1) {
    const date = new Date(firstOfLastWeek)
    date.setDate(date.getDate() + i)
    const key = dayKey(date)
    const future = date > now
    days[i] = {
      key,
      date,
      count: future ? 0 : counts[key] || 0,
      future,
      weekday: WEEKDAYS[date.getDay()],
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    }
  }

  const out = []
  for (let w = 0; w < weeks; w += 1) out.push(days.slice(w * 7, w * 7 + 7))
  return out
}

// Nível de intensidade da célula do calendário (0 = sem atividade).
export function heatLevel(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count <= 2) return 2
  if (count <= 4) return 3
  return 4
}

// ─── FORMATAÇÃO ──────────────────────────────────────────────

export function pctOfScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}

export function formatDateTime(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatFullDate(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function relativeDate(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  const days = Math.floor((Date.now() - t) / DAY_MS)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${Math.floor(days / 7)} semanas`
  return `há ${Math.floor(days / 30)} meses`
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}