// ─── CONQUISTAS ──────────────────────────────────────────────
//
// Catálogo simples e determinístico: cada conquista é uma função que
// recebe o resumo do usuário (nível, XP, streak, dias ativos, amigos,
// atividades, tópicos dominados) e devolve true/false.
//
// Regras que o app respeita:
//   - não existe endpoint de conquista no backend: tudo é derivado do que
//     o usuário já tem, então desbloquear é sempre uma consequência de
//     usar o app, não de chamar uma API;
//   - conquest bloqueada NÃO mostra como conseguir (o usuário pediu
//     assim): só aparece o título e o cadeado;
//   - a data de desbloqueio é a primeira vez que o app viu a conquista
//     ativa, guardada em localStorage. Não há data "oficial" no servidor.

import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'metapps:achievements'

// stats: {
//   xp, level, goals, streak, bestStreak, activeDays,
//   activities, mastered, friends, achievements (conta)
// }
export const ACHIEVEMENTS = [
  { id: 'first_goal',    title: 'Primeiro passo',   desc: 'Você criou a sua primeira trilha.',              tone: 'blue',   test: s => s.goals >= 1 },
  { id: 'three_goals',   title: 'Explorador',        desc: 'Você criou três trilhas diferentes.',             tone: 'violet', test: s => s.goals >= 3 },
  { id: 'five_goals',    title: 'Colecionador',      desc: 'Você mantém cinco trilhas ativas.',              tone: 'blue',   test: s => s.goals >= 5 },
  { id: 'first_activity',title: 'Em movimento',      desc: 'Você concluiu sua primeira atividade.',          tone: 'green',  test: s => s.activities >= 1 },
  { id: 'fifty',         title: 'Constância',        desc: 'Você concluiu cinquenta atividades.',            tone: 'green',  test: s => s.activities >= 50 },
  { id: 'hundred',       title: 'Maratonista',       desc: 'Você concluiu cem atividades.',                  tone: 'green',  test: s => s.activities >= 100 },
  { id: 'mastered_10',   title: 'Dominador',         desc: 'Você dominou dez tópicos de trilha.',           tone: 'amber',  test: s => s.mastered >= 10 },
  { id: 'streak_3',      title: 'Ritmo',             desc: 'Você estudou três dias seguidos.',                tone: 'amber',  test: s => s.bestStreak >= 3 },
  { id: 'streak_7',      title: 'Semana perfeita',   desc: 'Você estudou sete dias seguidos.',                tone: 'amber',  test: s => s.bestStreak >= 7 },
  { id: 'streak_30',     title: 'Hábito formado',    desc: 'Você estudou trinta dias seguidos.',              tone: 'red',    test: s => s.bestStreak >= 30 },
  { id: 'days_30',       title: 'Março completo',    desc: 'Você teve atividade em trinta dias.',             tone: 'blue',   test: s => s.activeDays >= 30 },
  { id: 'xp_500',        title: 'Quinhentos XP',     desc: 'Você somou quinhentos pontos de experiência.',    tone: 'violet', test: s => s.xp >= 500 },
  { id: 'xp_2000',       title: 'Duzentos XP',       desc: 'Você somou dois mil pontos de experiência.',     tone: 'violet', test: s => s.xp >= 2000 },
  { id: 'level_5',       title: 'Veterano',          desc: 'Você chegou ao nível cinco.',                    tone: 'amber',  test: s => s.level >= 5 },
  { id: 'level_10',      title: 'Mestre do Metapps', desc: 'Você chegou ao nível dez.',                      tone: 'red',    test: s => s.level >= 10 },
  { id: 'first_friend',  title: 'Não é sozinho',     desc: 'Você adicionou o seu primeiro amigo.',           tone: 'cyan',   test: s => s.friends >= 1 },
  { id: 'social_5',      title: 'Turma',             desc: 'Você está acompanhado de cinco amigos.',         tone: 'cyan',   test: s => s.friends >= 5 },
  // `stats.achievements` conta as OUTRAS conquistas desbloqueadas (o
  // chamador exclui esta ao avaliar, senão seria circular). Por isso o
  // alvo é length - 1 e não length: quem traz o número não se conta.
  { id: 'all_of_them',   title: 'Coleção completa',  desc: 'Você desbloqueou todas as conquistas.',          tone: 'green',  test: s => s.achievements >= ACHIEVEMENTS.length - 1 },
]

// Avalia o catálogo contra o resumo. É PURO: devolve cada item com
// `unlocked` e, se já tiver sido registrado, a data. A gravação fica em
// rememberUnlocks, chamado depois num efeito — escrever localStorage
// durante o render quebra com render duplo do StrictMode.
export function evaluateAchievements(stats) {
  const saved = readJSON(STORAGE_KEY, {})

  return ACHIEVEMENTS.map(a => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    tone: a.tone,
    unlocked: !!a.test(stats),
    unlockedAt: saved[a.id] || null,
  }))
}

// Grava a data de hoje nas conquistas que apareceram ativas pela primeira
// vez. A data é o dia em que ESTE APP viu a conquista ativa — não existe
// data "oficial" no servidor, porque não existe registro de conquista.
export function rememberUnlocks(achievements) {
  const saved = readJSON(STORAGE_KEY, {})
  const today = new Date().toISOString()
  let changed = false

  for (const a of achievements) {
    if (a.unlocked && !saved[a.id]) {
      saved[a.id] = today
      changed = true
    }
  }

  if (changed) writeJSON(STORAGE_KEY, saved)
  return saved
}

// Zera o registro local (usado em "limpar dados locais" das configurações).
export function resetAchievementDates() {
  writeJSON(STORAGE_KEY, {})
}