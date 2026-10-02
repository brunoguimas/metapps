import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, evaluateAchievements } from './achievements'

// As conquistas leem um registro local. Os testes não devem depender nem
// sujar o localStorage do navegador, então cada caso monta as stats e
// avalia o catálogo puro (evaluateAchievements não escreve nada).
const stats = over => ({
  xp: 0,
  level: 1,
  goals: 0,
  streak: 0,
  bestStreak: 0,
  activeDays: 0,
  activities: 0,
  mastered: 0,
  friends: 0,
  achievements: 0,
  ...over,
})

const byId = list => Object.fromEntries(list.map(a => [a.id, a]))

describe('catálogo de conquistas', () => {
  it('tem ids únicos', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda conquista tem título, descrição e tom', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title).toBeTruthy()
      expect(a.desc).toBeTruthy()
      expect(a.tone).toBeTruthy()
    }
  })

  it('ninguém começa desbloqueada com uma conta zerada', () => {
    const list = evaluateAchievements(stats())
    expect(list.filter(a => a.unlocked)).toHaveLength(0)
  })
})

describe('desbloqueio', () => {
  it('primeira atividade libera "Em movimento"', () => {
    const list = byId(evaluateAchievements(stats({ activities: 1 })))
    expect(list.first_activity.unlocked).toBe(true)
    expect(list.hundred.unlocked).toBe(false)
  })

  it('cinquenta atividades ainda não liberam o centenário', () => {
    const list = byId(evaluateAchievements(stats({ activities: 50 })))
    expect(list.fifty.unlocked).toBe(true)
    expect(list.hundred.unlocked).toBe(false)
  })

  it('o nível libera a conquista de veterano', () => {
    const list = byId(evaluateAchievements(stats({ level: 5 })))
    expect(list.level_5.unlocked).toBe(true)
    expect(list.level_10.unlocked).toBe(false)
  })

  it('amigos contam a partir de 1', () => {
    const list = byId(evaluateAchievements(stats({ friends: 1 })))
    expect(list.first_friend.unlocked).toBe(true)
    expect(list.social_5.unlocked).toBe(false)
  })

  it('melhor sequência de 7 dias libera a semana perfeita', () => {
    const list = byId(evaluateAchievements(stats({ bestStreak: 7 })))
    expect(list.streak_7.unlocked).toBe(true)
    expect(list.streak_30.unlocked).toBe(false)
  })
})

describe('coleção completa', () => {
  it('exige todas as outras conquistas', () => {
    // desbloqueia tudo menos a própria coleção
    const others = ACHIEVEMENTS.filter(a => a.id !== 'all_of_them')
    const full = {
      xp: 99999,
      level: 99,
      goals: 99,
      streak: 999,
      bestStreak: 999,
      activeDays: 999,
      activities: 9999,
      mastered: 999,
      friends: 999,
      achievements: others.length,
    }
    const list = byId(evaluateAchievements(full))
    expect(list.all_of_them.unlocked).toBe(true)
  })

  it('não libera enquanto falta uma das outras', () => {
    // falta a última das outras → `achievements` é length - 2
    const list = byId(evaluateAchievements(stats({ achievements: ACHIEVEMENTS.length - 2 })))
    expect(list.all_of_them.unlocked).toBe(false)
  })
})