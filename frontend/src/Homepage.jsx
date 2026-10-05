import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  logout as apiLogout,
  getAccessToken,
  refreshSession,
  listGoals,
  createGoal,
  generateRoadmap,
  generateTask,
  submitAttempt,
  getProfile,
  getMe,
  getRoadmap,
  generateCorrection,
  listAttemptsByUser,
  getProgressSummary,
  listFriends,
  searchUsers,
  addFriend,
  removeFriend,
  uploadAvatar,
  updateGoal,
  deleteGoal,
  setSessionExpiredHandler,
} from './api'
import conquistaIcon from './assets/conquista.svg'
import trilhaIcon from './assets/pixel.png'
import { avatarUrl, initials } from './lib/avatar'
import {
  activityByDay,
  activeDays,
  buildCalendar,
  currentStreak,
  heatLevel,
  longestStreak,
  pctOfScore,
  formatDateTime,
  formatFullDate,
  relativeDate,
  todayKey,
} from './lib/activity'
import { ACHIEVEMENTS, evaluateAchievements, rememberUnlocks, resetAchievementDates } from './lib/achievements'
import {
  achievementEvents,
  friendEvents,
  markAllRead,
  mergeNotifications,
  persistNotifications,
  readNotifications,
  streakEvents,
  unreadCount,
} from './lib/notify'
import './Homepage.css'

// Telas da trilha: nelas o cabeçalho global some (a trilha precisa do
// espaço vertical) e quem manda é o cabeçalho interno do caminho.
const TRACK_VIEWS = ['roadmap', 'phase', 'task', 'result']

// ─── HELPERS ─────────────────────────────────────────────────────

const sa = v => (Array.isArray(v) ? v : [])

// O Gemini entra em alta demanda com frequência. Quando isso acontece o
// backend responde 503 / UPSTREAM_UNAVAILABLE, que significa "tente de
// novo" — não "algo quebrou".
//
// O backend também mascara 5xx internos com a string literal
// "internal server error" (ver httpx.shouldSanitize). Se ela chegar até
// aqui, traduzimos em vez de exibir inglês no meio de uma tela toda em
// português.
function msgDeErro(e) {
  if (e?.status === 503 || e?.code === 'UPSTREAM_UNAVAILABLE') {
    return 'A IA está sobrecarregada agora. Aguarde alguns segundos e tente novamente.'
  }

  const msg = e?.message
  if (!msg || /^internal server error$/i.test(msg)) {
    return 'Algo quebrou ao gerar. Tente novamente em instantes.'
  }
  return msg
}

const XP_STEP = 100
const xpInLevel = xp => (xp || 0) % XP_STEP
const xpPct = xp => Math.min(100, Math.round((xpInLevel(xp) / XP_STEP) * 100))

// geometria do caminho de aprendizado (usada pelo render e pelo auto-scroll)
const PATH_SLOT_H = 148
const PATH_HEAD = 200
const PATH_X = [34, 66] // serpentina: alterna entre 34% e 66% da largura
const pathY = (index, total) => PATH_HEAD + (total - 1 - index) * PATH_SLOT_H

// pais = tópicos sem parent_topic_id
function getParents(topics) {
  return sa(topics).filter(t => !t.parent_topic_id)
}

// nós disponíveis = folhas cujos pré-requisitos diretos (dependencies:
// { topic_id, depends_on }) já foram completados.
function getAvailable(topics, dependencies, completedIds) {
  const ts = sa(topics)
  const ds = sa(dependencies)
  const done = new Set(sa(completedIds))
  const parentIds = new Set(ts.map(t => t.parent_topic_id).filter(Boolean))
  const leaves = ts.filter(t => !parentIds.has(t.id))
  return leaves.map(t => {
    const prereqs = ds.filter(d => d.topic_id === t.id).map(d => d.depends_on)
    const blocked = prereqs.some(p => !done.has(p))
    return { ...t, blocked }
  })
}

// Etapas: cada tópico pai é um módulo do caminho; órfãos viram módulos de
// lição única. A última etapa é o destino (o troféu), a primeira é o início.
function buildPhases(topics, dependencies, completedIds) {
  const available = getAvailable(topics, dependencies, completedIds)
  const parents = getParents(topics)
  const phases = []

  parents.forEach(p => {
    const children = available.filter(t => t.parent_topic_id === p.id)
    if (children.length) phases.push({ key: p.id, parent: p, children })
  })
  available.filter(t => !t.parent_topic_id).forEach(o => {
    phases.push({ key: o.id, parent: { id: o.id, title: o.title, description: o.description }, children: [o] })
  })

  phases.forEach((ph, i) => {
    const allDone = ph.children.length && ph.children.every(n => completedIds.includes(n.id))
    const hasPrevIncomplete = phases.slice(0, i).some(q => !(q.children.length && q.children.every(n => completedIds.includes(n.id))))
    ph.done = allDone
    ph.current = !allDone && !hasPrevIncomplete
    ph.locked = !allDone && hasPrevIncomplete
  })

  return phases
}

// materiais de texto de uma questão/lição (array de { type, data })
function textMaterials(rawMaterial) {
  return sa(rawMaterial)
    .map(m => (typeof m === 'string' ? m : m?.data))
    .filter(Boolean)
}

// Tópicos dominados, lidos do progresso persistido pelo backend.
//
// O roadmap já devolve `progress` (topic_progress). Derivar a lista de
// concluídos daqui é o que faz a trilha voltar como estava depois de um
// logout: antes o estado vivia só no React, que é desmontado no logout.
function completedFromProgress(roadmap) {
  return sa(roadmap?.progress)
    .filter(p => p?.topic_id && p?.status === 'MASTERED')
    .map(p => p.topic_id)
}

// Trilhas mais recentes primeiro. O backend não garante ordenação, então
// ordena no cliente para "recentes" significar realmente recente.
function byRecency(goals) {
  return [...sa(goals)].sort((a, b) => {
    const at = Date.parse(a?.created_at || '') || 0
    const bt = Date.parse(b?.created_at || '') || 0
    return bt - at
  })
}

// ─── HOMEPAGE ─────────────────────────────────────────────────────

export default function Homepage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState(null)
  const [goals, setGoals] = useState([])
  const [view, setView] = useState('home') // home | social | roadmap | phase | task | result | achievements | profile | settings
  const [lastTab, setLastTab] = useState('home')
  const [input, setInput] = useState('')
  const [curGoal, setCurGoal] = useState(null)
  const [topics, setTopics] = useState([])
  const [deps, setDeps] = useState([])
  const [completed, setCompleted] = useState([])
  const [selNode, setSelNode] = useState(null)
  const [task, setTask] = useState(null)
  const [taskNode, setTaskNode] = useState(null)
  const [answers, setAnswers] = useState({})
  const [essay, setEssay] = useState('')
  const [result, setResult] = useState(null)
  const [correction, setCorrection] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [initDone, setInitDone] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [selPhase, setSelPhase] = useState(null) // etapa aberta na view 'phase'
  const pathRef = useRef(null) // área rolável do caminho (trilha)

  // social
  const [friends, setFriends] = useState([])
  const [friendQuery, setFriendQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searching, setSearching] = useState(false)
  const [socialErr, setSocialErr] = useState('')
  const [pendingFriend, setPendingFriend] = useState('')

  // sino de notificações
  const [notifOpen, setNotifOpen] = useState(false)

  const username = profile?.username || email?.split('@')[0] || ''

  // ── inicialização ──
  useEffect(() => {
    setSessionExpiredHandler(() => navigate('/auth/login'))

    let cancelled = false

    async function init() {
      try {
        await refreshSession()
      } catch {
        // O refresh falhou, mas se ainda temos um access token válido em
        // memória (ex.: acabamos de logar com Google e o navegador não
        // aceitou o cookie de refresh do OAuth), seguimos — o getMe abaixo
        // usa esse token. Só mandamos pra tela de login se não houver token.
        if (!getAccessToken()) {
          navigate('/auth/login')
          return
        }
      }
      try {
        const user = await getMe()
        if (!cancelled) setEmail(user?.email || '')
      } catch {
        navigate('/auth/login')
        return
      }
      try {
        const p = await getProfile()
        if (!cancelled) setProfile(p)
      } catch { /* ignore */ }
      try {
        const g = await listGoals()
        if (!cancelled) setGoals(byRecency(g))
      } catch { /* ignore */ }
      // Histórico inteiro (e não só os 6 últimos): o calendário e o streak
      // precisam saber em quantos dias distintos a pessoa estudou.
      try {
        const a = await listAttemptsByUser()
        if (!cancelled) setAttempts(sa(a))
      } catch { /* ignore */ }
      try {
        const s = await getProgressSummary()
        if (!cancelled) setSummary(s)
      } catch { /* ignore */ }
      try {
        const f = await listFriends()
        if (!cancelled) setFriends(sa(f))
      } catch { /* ignore */ }
      if (!cancelled) setInitDone(true)
    }

    init()

    return () => { cancelled = true }
  }, [navigate])

  // ── streaks, calendário, conquistas e notificações ──
  //
  // Tudo isso é DERIVADO dos dados que já temos no cliente. Não existe
  // endpoint de conquistas nem de notificações no backend, e não deve
  // existir: são consequência de usar o app. O resumo do backend entra
  // como fonte dos números agregados (nível/XP/masteria) e o histórico
  // de tentativas responde "qual dia".
  const insights = useMemo(() => {
    const counts = activityByDay(attempts)
    const streak = currentStreak(counts)
    const best = longestStreak(counts)
    const days = activeDays(counts)

    const base = {
      xp: summary?.xp ?? profile?.xp ?? 0,
      level: summary?.level ?? profile?.level ?? 1,
      goals: goals.length,
      streak,
      bestStreak: best,
      activeDays: days,
      activities: attempts.length,
      mastered: summary?.topics?.mastered || 0,
      friends: friends.length,
      achievements: 0,
    }

    // "Coleção completa" conta as outras, então resolve antes de avaliar.
    const others = ACHIEVEMENTS.filter(a => a.id !== 'all_of_them' && a.test(base)).length
    const achievements = evaluateAchievements({ ...base, achievements: others })

    return {
      counts,
      streak,
      best,
      days,
      achievements,
      unlocked: achievements.filter(a => a.unlocked).length,
      calendar: buildCalendar(counts, 12),
      attemptsDone: summary?.tasks?.done ?? completed.length,
      friends: friends.length,
      avgScore: summary?.attempts?.average_score ?? null,
      topicsDone: summary?.topics?.mastered ?? 0,
      topicsTotal: summary?.topics?.total ?? 0,
      xp: base.xp,
      level: summary?.level ?? profile?.level ?? 1,
      xpMissing: summary?.xp_missing ?? Math.max(0, XP_STEP - xpInLevel(base.xp)),
      levelPct: summary?.level_pct ?? xpPct(base.xp),
    }
  }, [attempts, goals, friends, profile, summary, completed.length])

  // Notificações: o conjunto derivado vira lista persistida (o sino mostra
  // o que é novo, uma vez só por evento). O merge é puro no render; só a
  // gravação acontece no efeito.
  const [notifications, setNotifications] = useState(() => readNotifications())
  const unread = unreadCount(notifications)

  useEffect(() => {
    rememberUnlocks(insights.achievements)
    setNotifications(prev => {
      const merged = mergeNotifications(prev, [
        ...achievementEvents(insights.achievements),
        ...streakEvents(insights.best),
        ...friendEvents(friends),
      ])
      return merged === prev ? prev : persistNotifications(merged)
    })
  }, [insights.achievements, insights.best, friends])

  // Busca de amigos com debounce: o backend já limita a consulta, mas
  // digitar não deve virar uma request por tecla.
  useEffect(() => {
    const term = friendQuery.trim()
    if (term.length < 2) {
      setCandidates([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const found = await searchUsers(term)
        if (!cancelled) setCandidates(sa(found))
      } catch {
        if (!cancelled) setCandidates([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [friendQuery])

  // ── animação de chegada no caminho: começa no topo (troféu) e desce até a etapa atual ──
  useEffect(() => {
    if (view !== 'roadmap') return
    const el = pathRef.current
    if (!el) return

    const phases = buildPhases(topics, deps, completed)
    const curIdx = Math.max(0, phases.findIndex(f => f.current))
    const N = phases.length

    el.scrollTop = 0 // começa olhando o destino
    const t = setTimeout(() => {
      const y = pathY(curIdx, N)
      el.scrollTo({ top: Math.max(0, y - el.clientHeight * 0.55), behavior: 'smooth' })
    }, 550)
    return () => clearTimeout(t)
  }, [view, topics, completed, deps])

  // ── criar goal + gerar roadmap ──
  async function handleSend() {
    if (!input.trim() || loading) return
    setErr('')
    setLoading(true)
    try {
      const goal = await createGoal(input.trim(), {})
      const roadmap = await generateRoadmap(goal.id)
      const rawTopics = sa(roadmap?.topics)

      setGoals(prev => (prev.some(g => g.id === goal.id) ? prev : [goal, ...prev]))

      if (rawTopics.length === 0) {
        setErr('Não foi possível gerar a trilha (nenhum tópico retornado). Tente novamente.')
        return
      }

      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted(completedFromProgress(roadmap))
      setSelNode(null)
      setSelPhase(null)
      setView('roadmap')
      setInput('')
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // ── abrir trilha de goal existente ──
  async function handleOpenGoal(goal) {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      let roadmap
      try {
        roadmap = await getRoadmap(goal.id)
      } catch {
        roadmap = await generateRoadmap(goal.id)
      }
      const rawTopics = sa(roadmap?.topics)
      if (rawTopics.length === 0) {
        setErr('Não foi possível carregar a trilha (nenhum tópico retornado). Tente novamente.')
        return
      }
      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted(completedFromProgress(roadmap))
      setSelNode(null)
      setSelPhase(null)
      setView('roadmap')
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // uma lição já liberada dentro de um módulo → gera a tarefa direto (um clique)
  async function handleStartLesson(n) {
    if (n.blocked || loading) return
    setErr('')
    setLoading(true)
    try {
      const t = await generateTask(n.id)
      setTask(t)
      setTaskNode(n)
      setAnswers({})
      setEssay('')
      setResult(null)
      setCorrection(null)
      setView('task')
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // ── submeter resposta ──
  async function handleSubmit() {
    if (!task || loading) return
    setErr('')
    setLoading(true)
    setCorrection(null)
    try {
      const isQuiz = task.type === 'quiz'
      const content = task.content || {}
      const questions = sa(content.questions)
      let response

      if (isQuiz) {
        response = Object.entries(answers).map(([qi, ans]) => ({ question_index: parseInt(qi, 10), answer: ans }))
        if (response.length < questions.length) {
          setErr('Responda todas as perguntas.')
          setLoading(false)
          return
        }
      } else {
        response = essay.trim()
        const words = response.split(/\s+/).filter(Boolean).length
        if (words < (content.min_words || 0)) {
          setErr(`Mínimo de ${content.min_words} palavras.`)
          setLoading(false)
          return
        }
      }

      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)

      const attempt = data.task_attempt || data
      const score = typeof attempt.score === 'number' ? attempt.score : 0
      const requiredMastery = taskNode?.required_mastery ?? 0.7
      const topicId = task.topic_id || taskNode?.id
      const mastered = score >= requiredMastery

      if (topicId && mastered) {
        setCompleted(prev => (prev.includes(topicId) ? prev : [...prev, topicId]))
      }

      setView('result')

      const attemptId = attempt.id
      if (attemptId) {
        try {
          const corr = await generateCorrection(attemptId, task.type)
          setCorrection(corr)
        } catch { /* ignore */ }
      }

      // O XP é concedido pelo backend no Submit. Aqui só recarregamos o
      // perfil para refletir o valor novo: calcular e enviar de novo
      // somava o mesmo XP duas vezes em toda tentativa dominada.
      if (mastered) {
        try {
          const updatedProfile = await getProfile()
          if (updatedProfile) setProfile(updatedProfile)
        } catch { /* ignore */ }
      }

      // O histórico e o resumo são a fonte do calendário, do streak e das
      // conquistas — sem recarregar, a pessoa estuda e a tela não muda.
      try {
        setAttempts(sa(await listAttemptsByUser()))
      } catch { /* ignore */ }
      try {
        setSummary(await getProgressSummary())
      } catch { /* ignore */ }
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // ── CRUD de goals ──
  function handleLogout() {
    apiLogout()
    navigate('/auth/login')
  }

  // ── navegação principal (ícones / barra inferior) ──
  // A aba "Trilha" sempre abre a view de trilha: sem trilha selecionada ela
  // mostra as trilhas recentes do usuário, então não precisa cair no Início.
  function openRoadmap() {
    setErr('')
    setView('roadmap')
  }

  function handleNav(key) {
    setErr('')
    setSocialErr('')
    setNotifOpen(false)
    setLastTab(key)
    if (key === 'roadmap') openRoadmap()
    else setView(key)
  }

  // ── social ──

  // Depois de adicionar/remover, recarrega a lista em vez de usar o
  // retorno do POST: a resposta do POST só traz o vínculo NewlyAdded, sem
  // avatar/nível/streak, e a tela precisa mostrar o perfil público inteiro.
  async function refreshFriends() {
    try {
      setFriends(sa(await listFriends()))
    } catch { /* ignore */ }
  }

  async function handleAddFriend(query) {
    const term = String(query || '').trim()
    if (!term || pendingFriend) return
    setSocialErr('')
    setPendingFriend(term)
    try {
      await addFriend(term)
      await refreshFriends()
      setCandidates(prev => prev.map(c => (c.is_friend ? { ...c, is_friend: true } : c)))
    } catch (e) {
      setSocialErr(e.message)
    } finally {
      setPendingFriend('')
    }
  }

  async function handleRemoveFriend(friend) {
    if (pendingFriend) return
    setSocialErr('')
    setPendingFriend(friend.friend_id)
    try {
      await removeFriend(friend.friend_id)
      setFriends(prev => prev.filter(f => f.friend_id !== friend.friend_id))
    } catch (e) {
      setSocialErr(e.message)
    } finally {
      setPendingFriend('')
    }
  }

  function handleOpenBell() {
    // Abrir já marca como lido: a lista é curta e derivada, esconder as
    // não lidas atrás de um clique só faria o número nunca cair.
    setNotifications(prev => {
      const next = markAllRead(prev)
      return next === prev ? prev : persistNotifications(next)
    })
    setNotifOpen(v => !v)
  }

  async function handleUpdateGoal() {
    if (!editingGoal || !editInput.trim() || loading) return
    setErr('')
    setLoading(true)
    try {
      await updateGoal(editingGoal.id, editInput.trim(), editingGoal.settings || {})
      setGoals(prev => prev.map(g => (g.id === editingGoal.id ? { ...g, title: editInput.trim() } : g)))
      setEditingGoal(null)
      setEditInput('')
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteGoal(goal) {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      await deleteGoal(goal.id)
      setGoals(prev => prev.filter(g => g.id !== goal.id))
      if (curGoal?.id === goal.id) {
        setCurGoal(null)
        setTopics([])
        setDeps([])
        setCompleted([])
        // A view da trilha já trata "sem trilha aberta" mostrando as
        // recentes, então não precisa saltar para o Início.
        setView('roadmap')
      }
      setDeletingGoal(null)
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // ── avatar ──
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErr('Tipo não permitido. Use PNG, JPG, GIF ou WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr('O arquivo deve ter no máximo 10MB.')
      return
    }
    setErr('')
    setLoading(true)
    try {
      const data = await uploadAvatar(file)
      if (data?.avatar_url) setProfile(prev => ({ ...prev, avatar_url: data.avatar_url }))
    } catch (e) {
      setErr(msgDeErro(e))
    } finally {
      setLoading(false)
    }
  }

  // ── LOADING ──
  if (!initDone) {
    return (
      <div className="mp-center">
        <div className="mp-mark"><BrandGlyph /></div>
        <span>Preparando seu ambiente…</span>
      </div>
    )
  }

  // a aba "Trilha" continua ativa nas views que fazem parte do caminho
  const navActive = ['phase', 'task', 'result'].includes(view) ? 'roadmap' : view
  const goBack = {
    phase: () => setView('roadmap'),
    task: () => setView('roadmap'),
    result: () => setView('roadmap'),
    social: () => setView('home'),
    profile: () => setView('home'),
    achievements: () => setView('home'),
    settings: () => setView(lastTab === 'settings' ? 'home' : lastTab),
  }[view]

  // O cabeçalho global some na trilha: lá quem manda é o cabeçalho interno
  // do caminho, e a logo + sino + engrenagem só roubariam altura útil.
  const showTopbar = !TRACK_VIEWS.includes(view)

  return (
    <AppShell
      active={navActive}
      onNavigate={handleNav}
      onBack={goBack}
      showTopbar={showTopbar}
      profile={profile}
      username={username}
      email={email}
      onLogout={handleLogout}
      onOpenSettings={() => { setLastTab(view); setErr(''); setView('settings') }}
      onOpenBell={handleOpenBell}
      notifOpen={notifOpen}
      unread={unread}
      notifications={notifications}
    >
      {view === 'home' && (
        <HomeView
          attempts={attempts}
          insights={insights}
          onGoRoadmap={() => handleNav('roadmap')}
        />
      )}

      {view === 'social' && (
        <SocialView
          friends={friends}
          candidates={candidates}
          query={friendQuery}
          setQuery={setFriendQuery}
          searching={searching}
          err={socialErr}
          pending={pendingFriend}
          onAdd={handleAddFriend}
          onRemove={handleRemoveFriend}
        />
      )}

      {view === 'roadmap' && (
        curGoal && topics.length > 0 ? (
          <PathView
            curGoal={curGoal}
            topics={topics}
            deps={deps}
            completed={completed}
            goals={goals}
            loading={loading}
            err={err}
            pathRef={pathRef}
            onOpenGoal={handleOpenGoal}
            onEditGoal={g => { setErr(''); setEditingGoal(g); setEditInput(g.title) }}
            onDeleteGoal={g => { setErr(''); setDeletingGoal(g) }}
            onOpenPhase={(ph) => { setErr(''); setSelPhase(ph); setView('phase') }}
            onBackToList={() => {
              setErr('')
              setCurGoal(null)
              setTopics([])
              setDeps([])
              setCompleted([])
              setView('roadmap')
            }}
          />
        ) : (
          <RecentTracksView
            goals={goals}
            loading={loading}
            err={err}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onOpenGoal={handleOpenGoal}
            onEditGoal={g => { setErr(''); setEditingGoal(g); setEditInput(g.title) }}
            onDeleteGoal={g => { setErr(''); setDeletingGoal(g) }}
          />
        )
      )}

      {view === 'phase' && selPhase && (
        <PhaseView
          phase={selPhase}
          completed={completed}
          selNode={selNode}
          loading={loading}
          err={err}
          onBack={() => setView('roadmap')}
          onLesson={handleStartLesson}
        />
      )}

      {view === 'task' && task && (
        <TaskView
          task={task}
          answers={answers}
          setAnswers={setAnswers}
          essay={essay}
          setEssay={setEssay}
          loading={loading}
          err={err}
          onSubmit={handleSubmit}
        />
      )}

      {view === 'result' && result && (
        <ResultView
          result={result}
          task={task}
          taskNode={taskNode}
          correction={correction}
          onRetry={() => { setView('task'); setAnswers({}); setEssay(''); setResult(null); setErr('') }}
          onNext={() => { setErr(''); setView('roadmap') }}
        />
      )}

      {view === 'profile' && (
        <ProfileView
          profile={profile}
          summary={summary}
          username={username}
          email={email}
          friends={friends}
          insights={insights}
          loading={loading}
          err={err}
          onUpload={handleAvatarUpload}
          onGoSocial={() => handleNav('social')}
          onGoAchievements={() => handleNav('achievements')}
        />
      )}

      {view === 'achievements' && (
        <AchievementsView achievements={insights.achievements} unlocked={insights.unlocked} />
      )}

      {view === 'settings' && (
        <SettingsView
          profile={profile}
          username={username}
          email={email}
          insights={insights}
          onProfile={() => { setLastTab('settings'); setView('profile') }}
          onAchievements={() => { setLastTab('settings'); setView('achievements') }}
          onSocial={() => { setLastTab('settings'); setView('social') }}
          onHistory={() => navigate('/history')}
          onLogout={handleLogout}
          onClearLocal={() => {
            resetAchievementDates()
            setNotifications(persistNotifications(markAllRead([])))
          }}
        />
      )}

      {editingGoal && (
        <Modal onClose={() => { setEditingGoal(null); setErr('') }}>
          <h3 className="mp-modal__t">Editar objetivo</h3>
          <textarea
            className="mp-input"
            style={{ minHeight: 84 }}
            value={editInput}
            onChange={e => setEditInput(e.target.value)}
            rows={2}
            autoFocus
          />
          {err && <Alert>{err}</Alert>}
          <div className="mp-modal__a">
            <button type="button" onClick={() => { setEditingGoal(null); setErr('') }} style={{ flex: 1 }} className="mp-btn mp-btn--ghost">Cancelar</button>
            <button
              type="button"
              onClick={handleUpdateGoal}
              disabled={!editInput.trim() || loading}
              className="mp-btn"
              style={{ flex: 1 }}
            >
              {loading ? <Spinner /> : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {deletingGoal && (
        <Modal onClose={() => { setDeletingGoal(null); setErr('') }}>
          <h3 className="mp-modal__t">Excluir objetivo</h3>
          <p className="mp-muted">
            Tem certeza que deseja excluir <strong style={{ color: 'var(--ink)' }}>{deletingGoal.title}</strong>? Esta trilha e todo o seu progresso serão perdidos.
          </p>
          {err && <Alert>{err}</Alert>}
          <div className="mp-modal__a">
            <button type="button" onClick={() => { setDeletingGoal(null); setErr('') }} style={{ flex: 1 }} className="mp-btn mp-btn--ghost">Cancelar</button>
            <button
              type="button"
              onClick={() => handleDeleteGoal(deletingGoal)}
              disabled={loading}
              className="mp-btn mp-btn--red"
              style={{ flex: 1 }}
            >
              {loading ? <Spinner /> : 'Excluir'}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}

// ─── VIEWS ────────────────────────────────────────────────────────

function HomeView({ insights, attempts, onGoRoadmap }) {
  const recent = sa(attempts).slice(0, 5)
  const activeToday = !!insights.counts[todayKey()]

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        {/* 1. sequência + mapa de calor dos últimos 5 dias */}
        <StreakCard insights={insights} />

        {/* 2. última atividade (o "Resumo" saiu) */}
        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}>
            <IconHistory /> Última atividade
            <HistoryLink />
          </div>

          {recent.length === 0 ? (
            <button type="button" onClick={onGoRoadmap} className="mp-empty mp-empty--action">
              <IconPath />
              Nenhuma atividade ainda. Abra uma trilha para a sua primeira atividade aparecer aqui.
            </button>
          ) : (
            <div className="mp-attempts">
              {recent.map(a => <AttemptRow key={a.id} attempt={a} />)}
            </div>
          )}
        </section>

        {/* Os atalhos saíram daqui: Início é sequência + histórico, e o
           resto (Trilha, Social, Conquistas, Perfil) já vive no rail. */}

        {!activeToday && insights.days > 0 && (
          <Alert tone="info" style={{ marginTop: 0 }}>
            Você ainda não estudou hoje. Uma atividade qualquer já mantém sua sequência.
          </Alert>
        )}
      </div>
    </div>
  )
}

// ─── CARD DE SEQUÊNCIA ────────────────────────────────────────────
//
// Um dia conta como ativo quando existe pelo menos UMA atividade nele.
// O mapa de calor mostra só os 5 últimos dias (hoje é o último), saindo do
// mesmo `calendar` que já existia: achata as semanas, descarta os dias
// futuros e pega os 5 finais.
function StreakCard({ insights }) {
  const { streak, best, days, calendar, counts } = insights
  const recentDays = calendar.flat().filter(d => !d.future).slice(-5)
  const lastIdx = recentDays.length - 1

  return (
    <section className="mp-streak">
      <div className="mp-streak__top">
        <div className="mp-streak__num">
          <span className="mp-streak__flame"><IconFlame size={30} /></span>
          <strong>{streak}</strong>
          <span className="mp-streak__unit">
            {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </span>
        </div>
        <p className="mp-streak__hint">
          {streak === 0
            ? (days === 0
              ? 'Sua sequência começa na primeira atividade de hoje.'
              : 'Estude hoje para retomar sua sequência.')
            : (streak === 1
              ? 'Voltou! Estude mais uma vez hoje para chegar a 2 dias.'
              : `Mantenha o ritmo: mais ${7 - (streak % 7 || 7)} dias e você bate uma semana.`)}
        </p>
      </div>

      <div className="mp-heat">
        <div className="mp-heat__grid">
          {recentDays.map((d, i) => (
            <div key={d.key} className={`mp-heat__d ${i === lastIdx ? 'is-today' : ''}`}>
              <span
                className="mp-heat__cell"
                data-level={heatLevel(d.count)}
                title={`${d.label} · ${d.count} ${d.count === 1 ? 'atividade' : 'atividades'}`}
              >
                {d.count > 0 ? d.count : ''}
              </span>
              <span className="mp-heat__lbl">
                {i === lastIdx ? 'Hoje' : d.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mp-streak__foot">
        <div className="mp-streak__stat">
          <b>{best}</b>
          <span>Melhor sequência</span>
        </div>
        <div className="mp-streak__stat">
          <b>{days}</b>
          <span>Dias ativos</span>
        </div>
        {!!counts[todayKey()] && (
          <span className="mp-streak__done"><IconCheck size={14} /> Hoje registrado</span>
        )}
      </div>
    </section>
  )
}

function HistoryLink() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/history')}
      className="mp-h__more"
    >
      Ver tudo <IconChevron size={14} />
    </button>
  )
}

function AttemptRow({ attempt }) {
  const pct = pctOfScore(attempt?.score)
  const tone = pct === null ? 'blue' : pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red'
  const title = attempt?.task?.title || attempt?.task_title || 'Atividade'

  return (
    <div className="mp-attempt">
      <span className={`mp-attempt__ico mp-attempt__ico--${tone}`}>
        {pct === null ? <IconBolt /> : <IconCheck />}
      </span>
      <span className="mp-attempt__b">
        <span className="mp-attempt__t">{title}</span>
        <span className="mp-attempt__s">{formatDateTime(attempt?.created_at)}</span>
      </span>
      {pct !== null && <span className={`mp-attempt__p mp-attempt__p--${tone}`}>{pct}%</span>}
    </div>
  )
}

// Trilhas recentes dentro da própria tela da trilha: permite trocar de
// objetivo sem voltar ao Início. A trilha aberta fica marcada.
function RecentTracksCard({ goals, currentId, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  if (list.length <= 1) return null

  return (
    <div className="mp-card mp-card--pad">
      <div className="mp-h" style={{ marginBottom: 10 }}><IconHistory /> Trilhas recentes</div>
      <div className="mp-list">
        {list.map(g => {
          const active = g.id === currentId
          return (
            <div key={g.id} className={`mp-listrow mp-listrow--track ${active ? 'is-now' : ''}`}>
              <button
                type="button"
                className="mp-listrow__main"
                onClick={() => { if (!active) onOpenGoal(g) }}
                disabled={active}
              >
                <span className="mp-listrow__t">{g.title}</span>
                <span className="mp-listrow__s">{active ? 'Trilha atual' : relativeDate(g.created_at)}</span>
              </button>
              <span className="mp-listrow__tools">
                <button
                  type="button"
                  className="mp-goal__tool"
                  onClick={() => onEditGoal(g)}
                  aria-label={`Editar ${g.title}`}
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="mp-goal__tool mp-goal__tool--del"
                  onClick={() => onDeleteGoal(g)}
                  aria-label={`Excluir ${g.title}`}
                >
                  <IconTrash />
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GoalCard({ goal, onOpen, onEdit, onDelete }) {
  const s = goal.settings && typeof goal.settings === 'object' && !Array.isArray(goal.settings) ? goal.settings : {}
  const raw = goal.progress_pct ?? s.progress_pct
  const pct = typeof raw === 'number' ? Math.max(0, Math.min(100, Math.round(raw))) : null

  return (
    <div className="mp-goal">
      <button type="button" onClick={onOpen} className="mp-goal__open" aria-label={goal.title}>
        <span className="mp-goal__t">{goal.title}</span>
        {goal.description && (
          <span className="mp-faint" style={{ display: 'block', marginTop: 4, lineHeight: 1.45 }}>{goal.description}</span>
        )}
      </button>

      <div className="mp-goal__foot">
        {pct !== null ? (
          <>
            <span className="mp-goal__bar"><span className="mp-goal__fill" style={{ width: `${pct}%` }} /></span>
            <span className="mp-goal__n">{pct}%</span>
          </>
        ) : (
          <span className="mp-goal__n" style={{ flex: 1 }}>
            {typeof s.required_mastery === 'number' ? `Aprovar com ${Math.round(s.required_mastery * 100)}%` : 'Pronta para começar'}
          </span>
        )}
      </div>

      <div className="mp-goal__tools">
        <button type="button" className="mp-goal__tool" onClick={onEdit} aria-label="Editar objetivo"><IconEdit /></button>
        <button type="button" className="mp-goal__tool mp-goal__tool--del" onClick={onDelete} aria-label="Excluir objetivo"><IconTrash /></button>
      </div>
    </div>
  )
}

// A aba Trilha é a casa da criação: o composer saiu do Início e veio
// para cá, junto da lista, para o Início ficar só com sequência/resumo.
function RecentTracksView({ goals, loading, err, input, setInput, onSend, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        <section className="mp-trackbar">
          <div className="mp-trackbar__head">
            <span className="mp-trackbar__back"><img className="mp-trackbar__ico" src={trilhaIcon} alt="" draggable={false} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="mp-trackbar__t">Minhas trilhas</div>
              <div className="mp-trackbar__s">Descreva o que quer aprender</div>
            </div>
          </div>

          <div className="mp-trackbar__form">
            <textarea
              className="mp-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
              rows={2}
              style={{ minHeight: 62 }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || loading}
              className="mp-btn mp-btn--sm"
            >
              {loading ? <><Spinner /> Montando…</> : <>Gerar <IconArrowRight size={15} /></>}
            </button>
          </div>

          {loading && (
            <div className="mp-building">
              <span className="mp-dots"><i /><i /><i /></span>
              Montando as etapas da sua trilha…
            </div>
          )}
        </section>

        <section>
          <div className="mp-h" style={{ marginBottom: 4 }}>
            <IconTarget /> Trilhas recentes
          </div>
          <p className="mp-muted" style={{ marginBottom: 16 }}>
            Retome de onde parou ou comece uma trilha nova aí em cima.
          </p>

          {err && <Alert>{err}</Alert>}

          {list.length === 0 ? (
            <div className="mp-empty">
              <IconTarget size={26} />
              {loading ? 'Carregando suas trilhas…' : 'Nenhuma trilha ainda. Descreva o que você quer aprender acima.'}
            </div>
          ) : (
            <div className="mp-goals">
              {list.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onOpen={() => onOpenGoal(g)}
                  onEdit={() => onEditGoal(g)}
                  onDelete={() => onDeleteGoal(g)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PathView({ curGoal, topics, deps, completed, goals, loading, err, pathRef, onOpenGoal, onEditGoal, onDeleteGoal, onOpenPhase, onBackToList }) {
  const phases = buildPhases(topics, deps, completed)
  const totalLeaves = getAvailable(topics, deps, completed).length
  const doneLeaves = sa(topics).filter(t => completed.includes(t.id)).length
  const pct = Math.min(100, Math.round((doneLeaves / Math.max(1, totalLeaves)) * 100))

  // geometria do caminho — o destino fica em cima, o início embaixo
  const N = phases.length
  const height = 16 + N * PATH_SLOT_H + PATH_HEAD
  const pos = i => ({ x: PATH_X[i % PATH_X.length], y: pathY(i, N) })
  let pathD = ''
  phases.forEach((_, i) => {
    const p = pos(i)
    if (i === 0) pathD += `M ${p.x} ${p.y}`
    else {
      const prev = pos(i - 1)
      const midY = (prev.y + p.y) / 2
      pathD += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
    }
  })

  return (
    <div className="mp-canvas">
      <div className="mp-trilha">
        <div>
          {/* Cabeçalho da trilha. Nas telas de trilha o cabeçalho global
              (logo + sino + engrenagem) não aparece, então este é o único
              lugar de onde se volta — precisa de voltar e de trocar de
              trilha. */}
          <div className="mp-trackbar">
            <div className="mp-trackbar__head">
              <span className="mp-trackbar__back"><img className="mp-trackbar__ico" src={trilhaIcon} alt="" draggable={false} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mp-trackbar__t">{curGoal?.title || 'Sua trilha'}</div>
                <div className="mp-trackbar__s">Progresso da trilha</div>
              </div>
              {goals.length > 1 && (
                <button
                  type="button"
                  onClick={onBackToList}
                  className="mp-iconbtn"
                  aria-label="Trocar de trilha"
                  title="Trocar de trilha"
                >
                  <IconList />
                </button>
              )}
            </div>

            <div className="mp-trackbar__form">
              <div className="mp-trackbar__form" style={{ display: 'block', width: '100%' }}>
                <div className="mp-progress__top">
                  <span>Progresso da trilha</span>
                  <b>{doneLeaves}/{totalLeaves} · {pct}%</b>
                </div>
                <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          </div>

          {err && <div style={{ marginTop: 14 }}><Alert>{err}</Alert></div>}

          {loading && (
            <div className="mp-card mp-card--pad" style={{ textAlign: 'center', marginBottom: 18 }}>
              <Spinner size={26} />
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 10 }}>Preparando sua etapa…</div>
            </div>
          )}

          {!loading && N === 0 && (
            <div className="mp-empty">Nenhum tópico disponível nesta trilha.</div>
          )}

          {!loading && N > 0 && (
            <div ref={pathRef} className="mp-path-scroll">
              <div className="mp-path" style={{ height }}>
                <svg className="mp-path__svg" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
                  <path d={pathD} fill="none" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--blue)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="2 22"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.55"
                  />
                </svg>

                {/* destino */}
                <div className="mp-goalend" style={{ top: PATH_HEAD - 176, left: `${pos(N - 1).x}%` }}>
                  <div className="mp-goalend__disc"><img src={conquistaIcon} alt="" draggable={false} /></div>
                  <div className="mp-goalend__t">{curGoal?.title || 'Sua trilha'}</div>
                  <div className="mp-goalend__s">{pct}% concluída</div>
                </div>

                {phases.map((ph, i) => {
                  const p = pos(i)
                  const done = sa(ph.children).filter(n => completed.includes(n.id)).length
                  return (
                    <button
                      key={ph.key}
                      type="button"
                      className={`mp-node ${ph.done ? 'mp-node--done' : ph.current ? 'mp-node--now' : 'mp-node--lock'}`}
                      style={{ left: `${p.x}%`, top: p.y }}
                      onClick={() => { if (!ph.locked) onOpenPhase(ph) }}
                      disabled={ph.locked}
                    >
                      <span className="mp-node__disc">
                        {ph.done ? <IconCheck /> : ph.locked ? <IconLock /> : <IconBolt />}
                      </span>
                      <span className="mp-node__t">{ph.parent.title}</span>
                      <span className="mp-node__m">
                        {ph.done ? <><IconCheck size={11} /> {done}/{ph.children.length}</> : ph.locked ? 'bloqueado' : <>{done}/{ph.children.length} · aqui</>}
                      </span>
                    </button>
                  )
                })}

                <div className="mp-baselabel" style={{ top: height - 22 }}>INÍCIO</div>
              </div>
            </div>
          )}
        </div>

        <aside className="mp-trilha__side">
          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 8 }}><IconTarget /> Objetivo</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.3 }}>{curGoal?.title || '—'}</div>
            {curGoal?.description && <p className="mp-muted" style={{ marginTop: 8 }}>{curGoal.description}</p>}
          </div>

          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 10 }}><IconFlag /> Etapas</div>
            <div className="mp-list">
              {phases.map((ph, i) => (
                <button
                  key={ph.key}
                  type="button"
                  disabled={ph.locked}
                  onClick={() => { if (!ph.locked) onOpenPhase(ph) }}
                  className={`mp-listrow ${ph.done ? 'is-done' : ph.current ? 'is-now' : ''}`}
                  style={ph.locked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  <span className="mp-listrow__n">{ph.locked ? <IconLock size={13} /> : ph.done ? <IconCheck size={13} /> : i + 1}</span>
                  <span className="mp-listrow__t">{ph.parent.title}</span>
                  <span className="mp-listrow__x">{sa(ph.children).filter(n => completed.includes(n.id)).length}/{ph.children.length}</span>
                </button>
              ))}
            </div>
          </div>

          <RecentTracksCard
            goals={goals}
            currentId={curGoal?.id}
            onOpenGoal={onOpenGoal}
            onEditGoal={onEditGoal}
            onDeleteGoal={onDeleteGoal}
          />
        </aside>
      </div>
    </div>
  )
}

function PhaseView({ phase, completed, selNode, loading, err, onBack, onLesson }) {
  const ph = phase
  const done = sa(ph.children).filter(n => completed.includes(n.id)).length
  const pct = ph.children.length ? Math.round((done / ph.children.length) * 100) : 0

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        <section className="mp-card mp-card--pad">
          <div className="mp-h" style={{ marginBottom: 10 }}><IconFlag /> Etapa</div>
          <h1 className="mp-display">{ph.parent.title}</h1>
          <p className="mp-muted" style={{ marginTop: 8 }}>
            {ph.parent.description || `${ph.children.length} lição(ões) para concluir este módulo`}
          </p>
          <div className="mp-progress__top" style={{ marginTop: 20, marginBottom: 8 }}>
            <span>Lições concluídas</span>
            <b>{done}/{ph.children.length} · {pct}%</b>
          </div>
          <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
          {err && <Alert>{err}</Alert>}
        </section>

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> Lições do módulo</div>
          <div className="mp-lessons">
            {ph.children.map(n => (
              <LessonRow key={n.id} n={n} done={completed.includes(n.id)} current={selNode?.id === n.id} onClick={() => onLesson(n)} />
            ))}
          </div>
        </section>

        <div>
          <button type="button" onClick={onBack} className="mp-btn mp-btn--quiet" disabled={loading}>
            <IconArrowLeft /> Voltar para a trilha
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskView({ task, answers, setAnswers, essay, setEssay, loading, err, onSubmit }) {
  const isQuiz = task.type === 'quiz'
  const content = task.content || {}
  const questions = sa(content.questions)
  const title = content.title || task.meta?.title || 'Tarefa'
  const answered = isQuiz ? Object.keys(answers).length : 0
  const words = essay.trim() ? essay.trim().split(/\s+/).filter(Boolean).length : 0
  const pct = isQuiz
    ? (questions.length ? (answered / questions.length) * 100 : 0)
    : Math.min(100, (words / Math.max(1, content.min_words || 1)) * 100)

  return (
    <div className="mp-canvas">
      <div className="mp-task">
        <div>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> {title}</div>

          {content.description && (
            <div className="mp-card mp-card--pad" style={{ marginBottom: 16 }}>
              <p className="mp-muted" style={{ margin: 0 }}>{content.description}</p>
            </div>
          )}

          {isQuiz && questions.map((q, qi) => (
            <div key={qi} className="mp-qcard">
              <div className="mp-qcard__n">
                <span className="mp-qnum">{qi + 1}</span>
                {textMaterials(q.material).length > 0 && (
                  <span className="mp-tag" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>Material</span>
                )}
              </div>
              {textMaterials(q.material).map((t, mi) => <p key={mi} className="mp-material">{t}</p>)}
              <p className="mp-qtext">{q.statement || q.question}</p>
              <div className="mp-opts">
                {sa(q.options || q.alternatives).map((opt, ai) => (
                  <button
                    type="button"
                    key={ai}
                    onClick={() => setAnswers(p => ({ ...p, [qi]: ai }))}
                    className={`mp-opt ${answers[qi] === ai ? 'is-on' : ''}`}
                  >
                    <span className="mp-opt__k">{String.fromCharCode(65 + ai)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!isQuiz && (
            <div className="mp-qcard">
              {textMaterials(content.material).map((t, mi) => <p key={mi} className="mp-material">{t}</p>)}
              <p className="mp-qtext">{content.instructions}</p>
              <p className="mp-faint" style={{ marginBottom: 10 }}>
                {content.min_words}–{content.max_words} palavras
              </p>
              <textarea
                className="mp-input"
                style={{ minHeight: 260 }}
                value={essay}
                onChange={e => { setEssay(e.target.value) }}
                placeholder="Escreva sua resposta aqui…"
                rows={12}
              />
              <p className="mp-faint" style={{ textAlign: 'right', marginTop: 8 }}>
                {essay.trim() ? essay.trim().split(/\s+/).filter(Boolean).length : 0} palavras
              </p>
            </div>
          )}

          {err && <Alert>{err}</Alert>}
        </div>

        <aside className="mp-task__side mp-aside">
          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 10 }}>Seu progresso</div>
            <div className="mp-progress__top">
              <span>{isQuiz ? 'Respondidas' : 'Palavras'}</span>
              <b>{isQuiz ? `${answered}/${questions.length}` : `${words}/${content.min_words || 0}`}</b>
            </div>
            <div className="mp-track">
              <div className="mp-track__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button type="button" onClick={onSubmit} disabled={loading} className="mp-btn">
            {loading ? <><Spinner /> Enviando…</> : <>Enviar resposta <IconArrowRight /></>}
          </button>
        </aside>
      </div>
    </div>
  )
}

function ResultView({ result, task, taskNode, correction, onRetry, onNext }) {
  const attempt = result.task_attempt || result
  const score = typeof attempt.score === 'number' ? attempt.score : 0
  const pct = Math.round(score * 100)
  const tone = score >= 0.7 ? 'var(--green-d)' : score >= 0.4 ? 'var(--amber-d)' : 'var(--red-d)'
  let ev = null
  try { ev = typeof attempt.task_evaluation === 'string' ? JSON.parse(attempt.task_evaluation) : attempt.task_evaluation } catch { /* ignore */ }
  const content = task?.content || {}
  const questions = sa(content.questions)
  const requiredMastery = taskNode?.required_mastery ?? 0.7
  const mastered = score >= requiredMastery
  const items = sa(ev?.items)

  return (
    <div className="mp-canvas">
      <div className="mp-result">
        <div>
          <div className="mp-card mp-score">
            <Ring big value={pct} tone={tone} />
            <div className="mp-score__t">
              {mastered ? 'Etapa concluída!' : score >= 0.4 ? 'Bom esforço!' : 'Continue tentando!'}
            </div>
            <p className="mp-faint" style={{ textAlign: 'center' }}>
              {mastered ? 'Você dominou este tópico.' : `É preciso ${Math.round(requiredMastery * 100)}% para liberar a próxima etapa.`}
            </p>
          </div>

          <div className="mp-aside" style={{ marginTop: 16 }}>
            <button type="button" onClick={onRetry} className="mp-btn mp-btn--ghost">Tentar novamente</button>
            <button type="button" onClick={onNext} className="mp-btn">Próxima etapa <IconArrowRight /></button>
          </div>
        </div>

        <div className="mp-aside">
          {correction && (
            <div className="mp-ai">
              <div className="mp-ai__h"><IconSpark /> Feedback da IA</div>
              {typeof correction === 'string' ? (
                <p className="mp-ai__b" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{correction}</p>
              ) : (
                <>
                  {correction.summary && <p className="mp-ai__b" style={{ margin: 0 }}>{correction.summary}</p>}
                  {sa(correction.feedback || correction.comments || correction.items).map((f, i) => (
                    <div key={i} className="mp-ai__item">
                      {typeof f === 'string' ? f : (
                        <>
                          {f.comment && <div>{f.comment}</div>}
                          {f.correct === false && <div style={{ color: 'var(--red-d)', fontWeight: 800, marginTop: 4 }}>Correta: {f.correct_answer ?? f.expected}</div>}
                          {f.explanation && <div style={{ fontStyle: 'italic', opacity: 0.8, marginTop: 4 }}>{f.explanation}</div>}
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="mp-fb">
              <div className="mp-ai__h" style={{ marginBottom: 14 }}><IconCheck /> Revisão das questões</div>
              {items.map((item, i) => {
                const q = questions[i] || {}
                const opts = sa(q.options || q.alternatives)
                const ok = item.correct || item.is_correct || false
                const sub = item.submitted_answer ?? item.selected_answer ?? item.answer
                const cor = item.correct_answer ?? item.expected_answer
                return (
                  <div key={i} className={`mp-fb__row ${ok ? 'mp-fb__row--ok' : 'mp-fb__row--bad'}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mp-fb__q">Questão {i + 1}</div>
                      {opts[sub] !== undefined && <div className="mp-fb__a">Sua resposta: {opts[sub]}</div>}
                      {!ok && opts[cor] && <div className="mp-fb__a">Correta: {opts[cor]}</div>}
                      {item.explanation && <div className="mp-fb__e">{item.explanation}</div>}
                    </div>
                    {ok ? <IconCheck color="var(--green-d)" /> : <IconX color="var(--red-d)" />}
                  </div>
                )
              })}
            </div>
          )}

          {!correction && items.length === 0 && (
            <div className="mp-empty">Sem feedback disponível para esta tentativa.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileView({ profile, username, email, friends, insights, loading, err, onUpload, onGoSocial, onGoAchievements }) {
  const avatar = avatarUrl(profile?.avatar_url)

  return (
    <div className="mp-canvas">
      <div className="mp-profile">
        <section className="mp-card mp-card--pad" style={{ textAlign: 'center' }}>
          <label className="mp-avatar">
            {avatar ? (
              <img src={avatar} alt="avatar" />
            ) : (
              <div className="mp-avatar__fall">{initials(username)}</div>
            )}
            <span className="mp-avatar__lvl">{insights.level}</span>
            <span className="mp-avatar__edit"><IconEdit /></span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
          </label>

          <div className="mp-profile__name">{username}</div>
          <div className="mp-faint" style={{ marginTop: 2 }}>{email}</div>

          {err && <Alert style={{ textAlign: 'left' }}>{err}</Alert>}

          <div className="mp-xpbar">
            <div className="mp-xpbar__top">
              <span>Nível {insights.level}</span>
              <span style={{ color: 'var(--ink-3)' }}>{insights.xp - insights.xpMissing} / {insights.xp} XP</span>
            </div>
            <div className="mp-track"><div className="mp-track__fill" style={{ width: `${insights.levelPct}%` }} /></div>
            <div className="mp-faint" style={{ textAlign: 'right', marginTop: 8 }}>
              {insights.xpMissing} XP para o nível {insights.level + 1}
            </div>
          </div>

          {loading && <div className="mp-faint" style={{ marginTop: 14 }}><Spinner /> Enviando…</div>}
        </section>

        {/* números que o usuário pediu: nível, amigos, conquistas, streak */}
        <section className="mp-stats">
          <StatCard tone="amber" ico={<IconBolt />} v={insights.level} l="Nível" />
          <StatCard tone="amber" ico={<IconFlame />} v={insights.streak} l="Dias seguidos" />
          <StatCard tone="blue" ico={<IconUsers />} v={friends.length} l="Amigos" />
          <StatCard tone="green" ico={<IconTrophy />} v={insights.unlocked} l="Conquistas" />
        </section>

        <section className="mp-card mp-card--pad">
          <div className="mp-h" style={{ marginBottom: 12 }}><IconSpark /> Sua movimentação</div>
          <div className="mp-mini">
            <div className="mp-mini__i"><span>Melhor sequência</span><b>{insights.best} dias</b></div>
            <div className="mp-mini__i"><span>Dias ativos</span><b>{insights.days}</b></div>
            <div className="mp-mini__i"><span>Atividades feitas</span><b>{insights.attemptsDone}</b></div>
            <div className="mp-mini__i"><span>Tópicos dominados</span><b>{insights.topicsDone}</b></div>
          </div>
        </section>

        <div className="mp-aside">
          <button type="button" onClick={onGoSocial} className="mp-row mp-row--card">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue-d)' }}><IconUsers /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Meus amigos</span>
              <span className="mp-row__s">{friends.length ? `${friends.length} na sua lista` : 'Adicione alguém pelo e-mail ou @usuário'}</span>
            </span>
            <IconChevron />
          </button>
          <button type="button" onClick={onGoAchievements} className="mp-row mp-row--card">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
              <img src={conquistaIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b">
              <span className="mp-row__t">Minhas conquistas</span>
              <span className="mp-row__s">{insights.unlocked} de {ACHIEVEMENTS.length} desbloqueadas</span>
            </span>
            <IconChevron />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SOCIAL ────────────────────────────────────────────────────────

// Privacidade: a lista de amigos mostra só o perfil público (avatar,
// nível, sequência, última atividade). Nada de metas, trilhas ou tópicos
// do outro — o backend também não devolve esses campos.
function SocialView({ friends, candidates, query, setQuery, searching, err, pending, onAdd, onRemove }) {
  const already = new Set(friends.map(f => f.friend_id))
  const suggestions = (candidates || []).filter(c => !already.has(c.id))

  return (
    <div className="mp-canvas">
      <div className="mp-social">
        <section className="mp-card mp-card--pad mp-addfriend">
          <div className="mp-h" style={{ marginBottom: 10 }}><IconUsers /> Adicionar amigo</div>
          <p className="mp-muted" style={{ marginTop: 0 }}>
            Busque pelo e-mail cadastrado ou pelo nome de usuário.
          </p>

          <div className="mp-addfriend__row">
            <span className="mp-addfriend__ico"><IconSearch /></span>
            <input
              className="mp-input mp-input--bare"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e-mail ou @usuário"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {query && (
              <button
                type="button"
                className="mp-addfriend__go"
                onClick={() => onAdd(query)}
                disabled={!!pending || query.trim().length < 2}
                aria-label="Adicionar"
              >
                {pending === query.trim() ? <Spinner /> : <IconPlus />}
              </button>
            )}
          </div>

          {err && <Alert>{err}</Alert>}

          {searching && <div className="mp-faint" style={{ marginTop: 10 }}><Spinner /> Procurando…</div>}

          {!searching && suggestions.length > 0 && (
            <div className="mp-cands">
              {suggestions.map(c => (
                <div className="mp-cand" key={c.id}>
                  <Avatar src={avatarUrl(c.avatar_url)} name={c.username} level={c.level} size={38} />
                  <span className="mp-cand__b">
                    <span className="mp-cand__t">@{c.username}</span>
                    <span className="mp-cand__s">Nível {c.level} · {c.streak} {c.streak === 1 ? 'dia' : 'dias'} seguidos</span>
                  </span>
                  <button
                    type="button"
                    className="mp-btn mp-btn--sm"
                    onClick={() => onAdd(c.username)}
                    disabled={!!pending}
                  >
                    {pending === c.username ? <Spinner /> : 'Adicionar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && suggestions.length === 0 && !err && (
            <div className="mp-faint" style={{ marginTop: 10 }}>
              Ninguém encontrado para “{query.trim()}”.
            </div>
          )}
        </section>

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}>
            <IconUsers /> Seus amigos
            {friends.length > 0 && <span className="mp-count">{friends.length}</span>}
          </div>

          {friends.length === 0 ? (
            <div className="mp-empty">
              <IconUsers size={26} />
              Nenhum amigo ainda. Busque alguém pelo e-mail ou @usuário acima.
            </div>
          ) : (
            <div className="mp-friends">
              {friends.map(f => (
                <div className="mp-friend" key={f.friend_id}>
                  <Avatar src={avatarUrl(f.avatar_url)} name={f.username} level={f.level} size={46} />
                  <span className="mp-friend__b">
                    <span className="mp-friend__t">@{f.username}</span>
                    <span className="mp-friend__s">
                      Nível {f.level} · {f.xp} XP
                      {f.streak > 0 && ` · ${f.streak} ${f.streak === 1 ? 'dia' : 'dias'} seguidos`}
                    </span>
                    {f.last_activity_date && (
                      <span className="mp-friend__s">
                        Última atividade {relativeDate(f.last_activity_date)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="mp-iconbtn mp-iconbtn--danger"
                    onClick={() => onRemove(f)}
                    disabled={!!pending}
                    aria-label={`Remover ${f.username}`}
                  >
                    {pending === f.friend_id ? <Spinner /> : <IconTrash />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Conquista bloqueada não mostra como conseguir — só o título e o cadeado.
// A descrição aparece quando desbloqueada, com a data do desbloqueio.
function AchievementsView({ achievements, unlocked }) {
  const total = achievements.length
  const pct = total ? Math.round((unlocked / total) * 100) : 0
  const on = achievements.filter(a => a.unlocked)
  const off = achievements.filter(a => !a.unlocked)

  return (
    <div className="mp-canvas">
      <div className="mp-ach">
        <section className="mp-heroach">
          <Ring big value={pct} tone="var(--amber-d)" />
          <div style={{ minWidth: 0 }}>
            <div className="mp-heroach__t">Conquistas</div>
            <div className="mp-heroach__s">{unlocked} de {total} desbloqueadas</div>
            <span className="mp-chip">
              <img src={conquistaIcon} alt="" draggable={false} />
              {unlocked === total ? 'Coleção completa!' : `${total - unlocked} ainda bloqueadas`}
            </span>
          </div>
        </section>

        {on.length > 0 && (
          <section>
            <div className="mp-h" style={{ marginBottom: 12 }}><IconTrophy /> Desbloqueadas</div>
            <div className="mp-badges">
              {on.map(a => (
                <div key={a.id} className="mp-badge is-on">
                  <div className="mp-badge__ico" style={{ background: `var(--${a.tone}-soft)` }}>
                    <img src={conquistaIcon} alt="" draggable={false} />
                  </div>
                  <div className="mp-badge__t">{a.title}</div>
                  <div className="mp-badge__d">{a.desc}</div>
                  <div className="mp-badge__f">
                    <span className="mp-tag">Desbloqueada</span>
                    {a.unlockedAt && <span className="mp-badge__n">{formatFullDate(a.unlockedAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {off.length > 0 && (
          <section>
            <div className="mp-h" style={{ marginBottom: 12 }}><IconLock /> Bloqueadas</div>
            <div className="mp-badges">
              {off.map(a => (
                <div key={a.id} className="mp-badge">
                  <div className="mp-badge__ico">
                    <IconLock size={22} />
                  </div>
                  <div className="mp-badge__t">{a.title}</div>
                  <div className="mp-badge__f">
                    <span className="mp-tag mp-tag--muted">Bloqueada</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SettingsView({ profile, username, email, insights, onProfile, onAchievements, onSocial, onHistory, onLogout, onClearLocal }) {
  const avatar = avatarUrl(profile?.avatar_url)

  return (
    <div className="mp-canvas">
      <div className="mp-settings">
        <section className="mp-settinggroup">
          <div className="mp-h">Conta</div>
          <button type="button" onClick={onProfile} className="mp-row">
            {avatar ? (
              <span className="mp-row__ico" style={{ overflow: 'hidden' }}>
                <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 11 }} />
              </span>
            ) : (
              <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontWeight: 800, fontSize: 15 }}>
                {initials(username)}
              </span>
            )}
            <span className="mp-row__b">
              <span className="mp-row__t">{username}</span>
              <span className="mp-row__s">{email}</span>
            </span>
            <span className="mp-row__cta">Editar</span>
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Estudo</div>
          <button type="button" onClick={onAchievements} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
              <img src={conquistaIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b">
              <span className="mp-row__t">Minhas conquistas</span>
              <span className="mp-row__s">{insights.unlocked} de {ACHIEVEMENTS.length}</span>
            </span>
            <IconChevron />
          </button>
          <button type="button" onClick={onSocial} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue-d)' }}><IconUsers /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Meus amigos</span>
              <span className="mp-row__s">{insights.friends} na sua lista</span>
            </span>
            <IconChevron />
          </button>
          <button type="button" onClick={onHistory} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><IconHistory /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Histórico de estudo</span>
              <span className="mp-row__s">Todas as suas atividades</span>
            </span>
            <IconChevron />
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Dados</div>
          <button type="button" onClick={onClearLocal} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><IconTrash /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Limpar dados locais</span>
              <span className="mp-row__s">Datas das conquistas e notificações deste navegador</span>
            </span>
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Sobre</div>
          <button type="button" onClick={() => window.open('/termos.html', '_blank')} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--green-soft)', color: 'var(--green-d)' }}><IconFlag /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Termos de uso</span>
              <span className="mp-row__s">Versão 1.0.0</span>
            </span>
            <IconChevron />
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Sessão</div>
          <button type="button" onClick={onLogout} className="mp-row mp-row--danger">
            <span className="mp-row__ico"><IconLogout /></span>
            <span className="mp-row__b"><span className="mp-row__t">Sair da conta</span></span>
            <IconChevron />
          </button>
        </section>
      </div>
    </div>
  )
}

// ─── PEÇAS ────────────────────────────────────────────────────────

function LessonRow({ n, done, current, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={n.blocked}
      className={`mp-lesson ${done ? 'is-done' : n.blocked ? 'is-lock' : current ? 'is-now' : ''}`}
    >
      <span className="mp-lesson__ico">
        {done ? <IconCheck /> : n.blocked ? <IconLock /> : current ? <IconSpark /> : <IconBolt />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="mp-lesson__t" style={{ display: 'block' }}>{n.title}</span>
        {n.description && <span className="mp-lesson__s" style={{ display: 'block' }}>{n.description}</span>}
      </span>
      <IconChevron />
    </button>
  )
}

function StatCard({ tone, ico, v, l }) {
  return (
    <div className="mp-stat">
      <span className="mp-stat__ico" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>{ico}</span>
      <span style={{ minWidth: 0 }}>
        <span className="mp-stat__v" style={{ display: 'block' }}>{v}</span>
        <span className="mp-stat__l" style={{ display: 'block' }}>{l}</span>
      </span>
    </div>
  )
}

// anel de progresso (SVG)
function Ring({ value, big, tone = 'var(--blue)' }) {
  const box = big ? 128 : 40
  const r = big ? 52 : 15
  const sw = big ? 12 : 7
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value || 0))
  return (
    <svg className={big ? 'mp-score__ring' : 'mp-xp__ring'} viewBox={`0 0 ${box} ${box}`} aria-hidden>
      <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={sw} />
      <circle
        cx={box / 2} cy={box / 2} r={r} fill="none" stroke={tone} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform={`rotate(-90 ${box / 2} ${box / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      {big && (
        <>
          <text x={box / 2} y={box / 2 - 2} textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--ink)">{pct}%</text>
          <text x={box / 2} y={box / 2 + 20} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink-3)">NO NÍVEL</text>
        </>
      )}
    </svg>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="mp-overlay" onClick={onClose} role="presentation">
      <div className="mp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

// tone="info" é o azul de identidade, não o âmbar de progresso: erro é
// vermelho, e lembrete amigável ("você ainda não estudou hoje") é
// informação — não é progresso, então não fala a língua do botão
// principal.
function Alert({ children, style, tone = 'error' }) {
  return (
    <div className={`mp-alert ${tone === 'info' ? 'mp-alert--info' : ''}`} style={style}>
      <IconAlert /> {children}
    </div>
  )
}

function Spinner({ size = 15 }) {
  return (
    <svg className="mp-spinner" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── SHELL + NAVEGAÇÃO ────────────────────────────────────────────

// A ordem é do usuário: Início, Social, Trilha, Conquistas, Perfil. A
// Trilha fica no centro e é a única que ganha o botão elevado — é a ação
// principal do app, o resto é navegação.
const NAV = [
  { key: 'home', label: 'Início', Icon: IconHome },
  { key: 'social', label: 'Social', Icon: IconUsers },
  { key: 'roadmap', label: 'Trilha', Icon: IconPath, primary: true },
  { key: 'achievements', label: 'Conquistas', Icon: IconTrophy },
  { key: 'profile', label: 'Perfil', Icon: IconUser },
]

// Títulos só valem para o rail do desktop; no mobile o cabeçalho é
// minimalista (logo + 2 ícones) e quem nomeia a tela é a própria view.
const TITLES = {
  home: ['Início', 'Sua sequência de estudos'],
  social: ['Social', 'Acompanhe seus amigos'],
  roadmap: ['Trilha', 'Siga o caminho até o objetivo'],
  phase: ['Etapa', 'Lições deste módulo'],
  task: ['Tarefa', 'Responda para avançar'],
  result: ['Resultado', 'Veja como você foi'],
  achievements: ['Conquistas', 'Suas medalhas'],
  profile: ['Perfil', 'Seus dados e progresso'],
  settings: ['Configurações', 'Conta e estudo'],
}

function AppShell({
  active,
  onNavigate,
  onBack,
  showTopbar,
  profile,
  username,
  email,
  onLogout,
  onOpenSettings,
  onOpenBell,
  notifOpen,
  unread,
  notifications,
  children,
}) {
  const [title, sub] = TITLES[active] || TITLES.home
  const avatar = avatarUrl(profile?.avatar_url)

  return (
    <div className="mp">
      <div className="mp-stage">
        {showTopbar && (
          <header className="mp-top">
            <button type="button" onClick={onBack} className="mp-top__logo" aria-label="Início">
              <span className="mp-mark mp-mark--sm" />
              <span className="mp-top__brand">Metapps</span>
            </button>

            <div className="mp-top__actions">
              <button
                type="button"
                onClick={onOpenBell}
                className={`mp-iconbtn ${notifOpen ? 'is-on' : ''}`}
                aria-label={unread > 0 ? `Notificações (${unread} novas)` : 'Notificações'}
                aria-expanded={notifOpen}
              >
                <IconBell />
                {unread > 0 && <span className="mp-badge-dot">{unread > 9 ? '9+' : unread}</span>}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="mp-iconbtn"
                aria-label="Configurações"
              >
                <IconGear />
              </button>
            </div>

            {notifOpen && (
              <NotificationPanel notifications={notifications} onClose={onOpenBell} />
            )}
          </header>
        )}

        {children}
      </div>

      <nav className="mp-tabbar" aria-label="Navegação principal">
        {NAV.map(it => <NavButton key={it.key} item={it} active={active === it.key} onNavigate={onNavigate} />)}
      </nav>

      <aside className="mp-rail">
        <div className="mp-rail__brand">
          <div className="mp-mark"><BrandGlyph /></div>
          <span>Metapps</span>
        </div>

        <div className="mp-rail__title">
          <span className="mp-rail__t">{title}</span>
          <span className="mp-rail__s">{sub}</span>
        </div>

        <div className="mp-rail__nav">
          {NAV.map(it => <NavButton key={it.key} item={it} active={active === it.key} onNavigate={onNavigate} />)}
        </div>

        <div className="mp-rail__foot">
          <div className="mp-user">
            <span className="mp-user__a">
              {avatar ? <img src={avatar} alt="" /> : <span>{initials(username)}</span>}
            </span>
            <span className="mp-user__b">
              <span className="mp-user__n">{username || 'Usuário'}</span>
              <span className="mp-user__e">{email}</span>
            </span>
          </div>
          <button type="button" onClick={onLogout} className="mp-signout">
            <IconLogout /> Sair da conta
          </button>
        </div>
      </aside>
    </div>
  )
}

function NotificationPanel({ notifications, onClose }) {
  return (
    <>
      <button type="button" className="mp-sheet__scrim" onClick={onClose} aria-label="Fechar notificações" />
      <div className="mp-sheet mp-notif" role="dialog" aria-label="Notificações">
        <div className="mp-sheet__grab" />
        <div className="mp-sheet__head">
          <span className="mp-sheet__t">Notificações</span>
        </div>

        {notifications.length === 0 ? (
          <div className="mp-empty" style={{ border: 0 }}>
            <IconBell size={24} />
            Nada por aqui ainda. Conquistas e marcos de sequência aparecem nesta lista.
          </div>
        ) : (
          <div className="mp-notif__list">
            {notifications.map(n => (
              <div key={n.id} className={`mp-notif__i ${n.read ? '' : 'is-new'}`}>
                <span className={`mp-notif__ico mp-notif__ico--${n.tone || 'blue'}`}>
                  {n.kind === 'achievement'
                    ? <img src={conquistaIcon} alt="" draggable={false} />
                    : n.kind === 'streak' ? <IconFlame /> : <IconUsers />}
                </span>
                <span className="mp-notif__b">
                  <span className="mp-notif__t">{n.title}</span>
                  <span className="mp-notif__d">{n.body}</span>
                </span>
                <span className="mp-notif__when">{relativeDate(n.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function NavButton({ item, active, onNavigate }) {
  return (
    <button
      type="button"
      className={`mp-nav ${active ? 'is-on' : ''} ${item.primary ? 'mp-nav--primary' : ''}`}
      onClick={() => onNavigate(item.key)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mp-nav__ico">
        {item.primary
          ? <img className="mp-nav__img" src={trilhaIcon} alt="" draggable={false} />
          : <item.Icon />}
      </span>
      <span className="mp-nav__label">{item.label}</span>
    </button>
  )
}

function Avatar({ src, name, level, size = 44 }) {
  const [broken, setBroken] = useState(false)
  const show = src && !broken

  return (
    <span className="mp-av" style={{ '--mp-av': `${size}px` }}>
      {show ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="mp-av__fall">{initials(name)}</span>
      )}
      {level != null && <span className="mp-av__lvl">{level}</span>}
    </span>
  )
}

// ─── ÍCONES ───────────────────────────────────────────────────────

function BrandGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 19c0-5 3-8 7-8s7 3 7 8" />
      <path d="M12 11V4" />
      <path d="M8.5 6.5 12 4l3.5 2.5" />
    </svg>
  )
}

function IconSpark({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
      <path d="M12 2.5l1.9 6.4 6.4 1.9-6.4 1.9L12 19.1l-1.9-6.4L3.7 10.8l6.4-1.9Z" />
      <path d="M19 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z" opacity=".75" />
    </svg>
  )
}

function IconEdit({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}

function IconTrash({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
}

function IconLock({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="11" width="16" height="9" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
}

function IconCheck({ size = 18, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
}

function IconX({ size = 18, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
}

function IconArrowLeft({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
}

function IconArrowRight({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
}

function IconChevron({ size = 15, color = 'var(--ink-3)' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
}

function IconHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
}

function IconPath() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="6" cy="18" r="2.6" /><circle cx="18" cy="6" r="2.6" /><path d="M8.6 18H14a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5.4" /></svg>
}

function IconUsers() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="9" cy="8" r="3.4" /><path d="M3.4 19.5a5.6 5.6 0 0 1 11.2 0" /><path d="M16.2 5a3.4 3.4 0 0 1 0 6.1" /><path d="M17.2 14.4a5.6 5.6 0 0 1 3.4 5.1" /></svg>
}

function IconUser() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8.4" r="3.6" /><path d="M4.8 19.6a7.2 7.2 0 0 1 14.4 0" /></svg>
}

function IconTrophy({ size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5.4H5.4V7a3.4 3.4 0 0 0 3.4 3.4" /><path d="M16 5.4h2.6V7a3.4 3.4 0 0 1-3.4 3.4" /><path d="M12 13v3.6" /><path d="M8.6 20h6.8" /><path d="M10.4 16.6h3.2L15.2 20H8.8l1.6-3.4Z" /></svg>
}

function IconFlame({ size = 20, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style} aria-hidden>
      <path d="M13.3 2.4c.6 3-1 4.6-2.6 6.1-1.7 1.6-3.5 3.2-3.5 5.8A6.9 6.9 0 0 0 14.1 21c3.5 0 6.1-2.6 6.1-6.1 0-3-1.6-4.7-3.2-6.5-1.5-1.7-3.1-3.2-3.7-6Z" />
      <path d="M11 12.6c.3 1.5-.5 2.4-1.3 3.1-.7.6-1.2 1.3-1.2 2.3a3.1 3.1 0 0 0 6.2.4c0-1.5-.9-2.5-1.8-3.3-.8-.7-1.5-1.5-1.9-2.5Z" opacity=".5" />
    </svg>
  )
}

function IconBell({ size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.4 10a5.6 5.6 0 0 1 11.2 0c0 4 1.5 5.2 1.5 5.2H4.9S6.4 14 6.4 10Z" /><path d="M10.2 18.6a2 2 0 0 0 3.6 0" /></svg>
}

function IconGear({ size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3.1" /><path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1" /></svg>
}

function IconSearch({ size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="6" /><path d="M15.4 15.4 20 20" /></svg>
}

function IconList({ size = 19 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6.5h16M4 12h16M4 17.5h10" /></svg>
}

function IconPlus({ size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5.2v13.6M5.2 12h13.6" /></svg>
}

function IconLogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
}

function IconHistory() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v5h5" /><path d="M12 7.5V12l3 2" /></svg>
}

function IconFlag() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4" /><path d="M5 4.5h13l-2.6 3.7L18 12H5" /></svg>
}

function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5V13" /><path d="M12 16.2h.01" /></svg>
}

function IconBolt({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden><path d="M13.4 2 5 13.4h5.2L9.6 22 19 10.4h-5.4L13.4 2Z" /></svg>
}

function IconStar({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden><path d="m12 2.6 2.85 5.9 6.4.9-4.63 4.5 1.1 6.4L12 17.3l-5.72 3 1.1-6.4-4.63-4.5 6.4-.9L12 2.6Z" /></svg>
}

function IconTarget({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
}
