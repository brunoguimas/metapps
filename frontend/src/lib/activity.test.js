import { describe, expect, it } from 'vitest'
import {
  activeDays,
  buildCalendar,
  currentStreak,
  dayKey,
  heatLevel,
  longestStreak,
} from './activity'

// Constrói uma tentativa com a data local desejada. O app conta dias no
// relógio local, então o teste também tem que montar a data localmente —
// usar UTC aqui faria o teste passar no Brasil e falhar no servidor.
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString()

describe('dayKey', () => {
  it('usa o dia local, não o UTC', () => {
    // 23h de Monday em São Paulo é 02h de Tuesday em UTC. Se usasse UTC,
    // a segunda-feira seria perdida.
    expect(dayKey(at(2026, 3, 2, 23))).toBe('2026-03-02')
  })

  it('formata com zero à esquerda', () => {
    expect(dayKey(at(2026, 1, 5))).toBe('2026-01-05')
  })

  it('devolve vazio para data inválida', () => {
    expect(dayKey('lixo')).toBe('')
    expect(dayKey(undefined)).toBe('')
  })
})

describe('currentStreak', () => {
  it('conta dias consecutivos terminando hoje', () => {
    const now = new Date()
    const d = n => {
      const x = new Date(now)
      x.setDate(x.getDate() - n)
      return dayKey(x)
    }
    const counts = { [d(0)]: 1, [d(1)]: 2, [d(2)]: 1 }
    expect(currentStreak(counts)).toBe(3)
  })

  it('não quebra quando várias atividades caem no mesmo dia', () => {
    const now = new Date()
    const d = n => {
      const x = new Date(now)
      x.setDate(x.getDate() - n)
      return dayKey(x)
    }
    // 5 atividades em dois dias ainda são 2 dias de sequência
    const counts = { [d(0)]: 4, [d(1)]: 1 }
    expect(currentStreak(counts)).toBe(2)
  })

  it('considera hoje e ontem como a mesma sequência', () => {
    const now = new Date()
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    // sem atividade hoje, mas ontem teve: o dia ainda não acabou
    const counts = { [dayKey(y)]: 1 }
    expect(currentStreak(counts)).toBe(1)
  })

  it('zera quando passou um dia inteiro sem atividade', () => {
    const now = new Date()
    const y = new Date(now)
    y.setDate(y.getDate() - 2)
    expect(currentStreak({ [dayKey(y)]: 1 })).toBe(0)
  })

  it('devolve zero sem nenhuma atividade', () => {
    expect(currentStreak({})).toBe(0)
  })

  it('para no primeiro buraco', () => {
    const now = new Date()
    const d = n => {
      const x = new Date(now)
      x.setDate(x.getDate() - n)
      return dayKey(x)
    }
    // hoje, ontem e anteontem; o dia anterior a anteontem está vazio
    const counts = { [d(0)]: 1, [d(1)]: 1, [d(2)]: 1 }
    expect(currentStreak(counts)).toBe(3)
  })
})

describe('longestStreak', () => {
  it('acha a maior sequência do histórico', () => {
    const counts = {
      '2026-01-01': 1, '2026-01-02': 1, '2026-01-03': 1,
      '2026-01-04': 1,
      '2026-01-10': 1, '2026-01-11': 1,
    }
    expect(longestStreak(counts)).toBe(4)
  })

  it('devolve zero sem histórico', () => {
    expect(longestStreak({})).toBe(0)
  })

  it('ignora chaves com contagem zero', () => {
    expect(longestStreak({ '2026-01-01': 1, '2026-01-02': 0 })).toBe(1)
  })
})

describe('activeDays', () => {
  it('conta dias distintos com atividade', () => {
    const counts = { '2026-01-01': 3, '2026-01-02': 1, '2026-01-03': 0 }
    expect(activeDays(counts)).toBe(2)
  })
})

describe('buildCalendar', () => {
  it('monta exatamente 7 colunas por semana pedida', () => {
    const weeks = buildCalendar({}, 12)
    expect(weeks).toHaveLength(12)
    for (const week of weeks) expect(week).toHaveLength(7)
  })

  it('marca dias futuros sem atividade', () => {
    const weeks = buildCalendar({}, 4)
    const lastDay = weeks[3][6]
    expect(lastDay.future).toBe(true)
    expect(lastDay.count).toBe(0)
  })

  it('atribui a contagem ao dia certo', () => {
    const today = new Date()
    const key = dayKey(today)
    const weeks = buildCalendar({ [key]: 3 }, 2)
    const flat = weeks.flat()
    const cell = flat.find(d => d.key === key)
    expect(cell.count).toBe(3)
    expect(cell.future).toBe(false)
  })

  it('inclui exatamente o dia de hoje no grid', () => {
    const weeks = buildCalendar({}, 2)
    const keys = weeks.flat().map(d => d.key)
    expect(keys).toContain(dayKey(new Date()))
  })
})

describe('heatLevel', () => {
  it('escala de 0 a 4 conforme a quantidade', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(2)).toBe(2)
    expect(heatLevel(4)).toBe(3)
    expect(heatLevel(99)).toBe(4)
  })
})