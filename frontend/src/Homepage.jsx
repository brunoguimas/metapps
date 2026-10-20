import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  logout as apiLogout,
  getAccessToken,
  refreshSession,
  listGoals,
  createGoal,
  generateRoadmap,
  generateTask,
  getProfile,
  getMe,
  getRoadmap,
  listAttemptsByUser,
  uploadAvatar,
  updateGoal,
  deleteGoal,
  setSessionExpiredHandler,
  getDaily,
  createPractice,
  createReview,
  listFriends,
  searchUsers,
  addFriend,
  removeFriend,
} from './api'
import LessonPlayer from './features/lesson/LessonPlayer.jsx'
import TodayCard from './features/home/TodayCard.jsx'
import { Busy, Spinner } from './ds'
import { userMessage } from './lib/errors.js'
import { avatarUrl, initials } from './lib/avatar'
import perfilIcon from './assets/perfil.svg'
import conquistaIcon from './assets/conquista.svg'
import configIcon from './assets/config.svg'
import { useTheme } from './theme'
import './Homepage.css'

// ─── HELPERS ─────────────────────────────────────────────────────

const sa = v => (Array.isArray(v) ? v : [])

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

function relativeDate(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${Math.floor(days / 7)} semanas`
  return `há ${Math.floor(days / 30)} meses`
}

function pctOfScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}

function formatDateTime(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── HOMEPAGE ─────────────────────────────────────────────────────

export default function Homepage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState(null)
  const [goals, setGoals] = useState([])
  const [view, setView] = useState('home') // home | roadmap | phase | task | result | profile | social | achievements | settings
  const [input, setInput] = useState('')
  const [curGoal, setCurGoal] = useState(null)
  const [topics, setTopics] = useState([])
  const [deps, setDeps] = useState([])
  const [completed, setCompleted] = useState([])
  const [selNode, setSelNode] = useState(null)
  const [task, setTask] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [initDone, setInitDone] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [selPhase, setSelPhase] = useState(null) // etapa aberta na view 'phase'
  const [daily, setDaily] = useState(null) // resumo do dia (meta, streak, revisão)
  const pathRef = useRef(null) // área rolável do caminho (trilha)

  // Social: lista de amigos, busca por e-mail/username e o estado da
  // requisição em andamento. A aba social veio do upstream; o estado mora
  // aqui para conviver com a lista de objetivos do design local.
  const [friends, setFriends] = useState([])
  const [friendQuery, setFriendQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searching, setSearching] = useState(false)
  const [socialErr, setSocialErr] = useState('')
  const [pendingFriend, setPendingFriend] = useState('')

  // O que está em andamento agora: objetivo sendo aberto ou atividade
  // sendo montada. É o que permite mostrar o spinner no item exato
  // que o usuário clicou (e não um aviso genérico no topo da tela).
  const [busyGoalId, setBusyGoalId] = useState(null)
  const [busyLessonId, setBusyLessonId] = useState(null)

  // A trilha está sendo montada pela IA. Separado do `loading` geral
  // (que também cobre salvar, excluir, upload…) para o aviso de
  // "montando" só aparecer quando é isso mesmo que está acontecendo.
  const [trackBusy, setTrackBusy] = useState(false)

  // A view atual, sempre atualizada. Montar uma trilha ou uma
  // atividade leva minutos: se o usuário navegar para outra tela
  // enquanto isso, a resposta não deve trocar a tela dele na cara.
  const viewRef = useRef(view)
  viewRef.current = view

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
      try {
        const a = await listAttemptsByUser()
        if (!cancelled) setAttempts(sa(a).slice(0, 6))
      } catch { /* ignore */ }
      try {
        const d = await getDaily()
        if (!cancelled) setDaily(d)
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
    setTrackBusy(true)
    try {
      const goal = await createGoal(input.trim(), {})

      // O objetivo entra na lista antes da geração: se a IA falhar, o
      // objetivo continua salvo e pode ser aberto depois (a abertura
      // tenta gerar a trilha de novo).
      setGoals(prev => (prev.some(g => g.id === goal.id) ? prev : [goal, ...prev]))

      const roadmap = await generateRoadmap(goal.id)
      const rawTopics = sa(roadmap?.topics)

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
      // se o usuário mudou de tela enquanto a trilha era montada, não
      // puxamos ele de volta para a trilha
      if (viewRef.current === 'home') setView('roadmap')
      setInput('')
    } catch (e) {
      setErr(userMessage(e, 'Não foi possível criar a trilha. Tente novamente.'))
    } finally {
      setLoading(false)
      setTrackBusy(false)
    }
  }

  // ── abrir trilha de goal existente ──
  async function handleOpenGoal(goal) {
    if (loading) return
    setErr('')
    setLoading(true)
    setBusyGoalId(goal.id)
    setTrackBusy(true)
    try {
      let roadmap = null

      try {
        roadmap = await getRoadmap(goal.id)
      } catch {
        roadmap = null
      }

      // O GET responde 200 mesmo quando o objetivo ainda não tem trilha
      // (por exemplo, quando a geração falhou no momento em que o
      // objetivo foi criado). Nesse caso pedimos a geração: o backend
      // devolve a trilha existente se ela já existir, então é seguro
      // chamar sempre que a leitura vier vazia.
      if (!sa(roadmap?.topics).length) {
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
      // a trilha só ocupa a tela se o usuário ainda estiver na aba
      if (viewRef.current === 'roadmap') setView('roadmap')
    } catch (e) {
      setErr(userMessage(e, 'Não foi possível abrir a trilha. Tente novamente.'))
    } finally {
      setLoading(false)
      setBusyGoalId(null)
      setTrackBusy(false)
    }
  }

  // uma lição já liberada dentro de um módulo → gera a tarefa direto (um clique)
  async function handleStartLesson(n) {
    if (n.blocked || loading) return
    setErr('')
    setLoading(true)
    setBusyLessonId(n.id)
    try {
      const t = await generateTask(n.id)
      setTask(t)
      // se o usuário mudou de tela enquanto a IA montava a atividade,
      // não voltamos para o player na cara dele
      if (viewRef.current === 'phase') setView('task')
    } catch (e) {
      setErr(userMessage(e, 'Não foi possível iniciar a atividade. Tente novamente.'))
    } finally {
      setLoading(false)
      setBusyLessonId(null)
    }
  }

  // ── Treino: sessão com os exercícios errados e os vencidos na revisão ──
  async function handlePractice() {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      const t = await createPractice(null, 10)
      setTask(t)
      setView('task')
    } catch (e) {
      setErr(userMessage(e, 'Não foi possível montar o treino. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Revisão: exercícios que já venceram o intervalo de repetição ──
  async function handleReview() {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      const t = await createReview(10)
      setTask(t)
      setView('task')
    } catch (e) {
      setErr(userMessage(e, 'Não foi possível montar a revisão. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  // ── conclusão de uma sessão: a trilha é recarregada do servidor ──
  //
  // O progresso do tópico (maestria, status) é gravado pelo backend no
  // finish da sessão; aqui só recarregamos a trilha para refletir o
  // estado novo sem depender de cache local.
  //
  // Sem esta recarga, a tela continuaria mostrando a trilha como estava
  // antes da sessão: o progresso zerado e as lições concluídas sem o
  // check — mesmo com o dado já gravado no banco.
  async function reloadRoadmap() {
    if (!curGoal) return
    try {
      const roadmap = await getRoadmap(curGoal.id)
      const rawTopics = sa(roadmap?.topics)
      if (rawTopics.length === 0) return
      const rawDeps = sa(roadmap?.dependencies)
      const done = completedFromProgress(roadmap)
      setTopics(rawTopics)
      setDeps(rawDeps)
      setCompleted(done)
      // A etapa aberta é um retrato do momento em que ela foi aberta:
      // recria com os dados novos para que as lições concluídas apareçam
      // com o check e o contador do módulo esteja atualizado.
      setSelPhase(prev => {
        if (!prev) return prev
        return buildPhases(rawTopics, rawDeps, done).find(p => p.key === prev.key) || prev
      })
    } catch { /* ignore */ }
  }

  // ── a sessão terminou: atualiza a trilha, o perfil e o resumo do dia ──
  async function handleSessionFinish() {
    await reloadRoadmap()
    try {
      const p = await getProfile()
      if (p) setProfile(p)
    } catch { /* ignore */ }
    try {
      const d = await getDaily()
      if (d) setDaily(d)
    } catch { /* ignore */ }
    // Volta para o módulo de onde a sessão saiu (aí o usuário vê a lição
    // concluída) ou, na falta dele, para a trilha.
    setView(selPhase ? 'phase' : curGoal ? 'roadmap' : 'home')
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
    if (key === 'roadmap') openRoadmap()
    else setView(key)
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
      setErr(userMessage(e, 'Não foi possível atualizar o objetivo. Tente novamente.'))
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
      setErr(userMessage(e, 'Não foi possível excluir o objetivo. Tente novamente.'))
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
      setErr(userMessage(e, 'Não foi possível enviar a imagem. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  // ── SOCIAL ──
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
      setSocialErr(userMessage(e, 'Não foi possível adicionar o amigo.'))
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
      setSocialErr(userMessage(e, 'Não foi possível remover o amigo.'))
    } finally {
      setPendingFriend('')
    }
  }

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
  const navActive = ['phase', 'task'].includes(view) ? 'roadmap' : view
  const goBack = {
    phase: () => setView('roadmap'),
    task: () => setView(curGoal ? 'roadmap' : 'home'),
    profile: () => setView('home'),
    social: () => setView('home'),
    achievements: () => setView('home'),
    settings: () => setView('home'),
  }[view]

  // O player é uma tela focada: sem rail, sem tabbar e sem o cabeçalho
  // do app. É o que separa a sessão do resto da navegação e deixa o
  // exercício ser o único foco na tela.
  if (view === 'task' && task) {
    return (
      <div className="mp mp--player">
        <LessonPlayer
          task={task}
          err={err}
          onExit={async () => {
            setErr('')
            // A sessão pode ter sido encerrada antes (o botão de sair
            // aparece no resumo): recarrega a trilha para não voltar
            // com um estado velho.
            await reloadRoadmap()
            setView(selPhase ? 'phase' : curGoal ? 'roadmap' : 'home')
          }}
          onFinish={handleSessionFinish}
        />
      </div>
    )
  }

  return (
    <AppShell
      active={navActive}
      onNavigate={handleNav}
      onBack={goBack}
      profile={profile}
      username={username}
      email={email}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {view === 'home' && (
        <HomeView
          username={username}
          profile={profile}
          goals={goals}
          attempts={attempts}
          daily={daily}
          input={input}
          setInput={setInput}
          err={err}
          loading={loading}
          trackBusy={trackBusy}
          onSend={handleSend}
          onPractice={handlePractice}
          onReview={handleReview}
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
            trackBusy={trackBusy}
            busyGoalId={busyGoalId}
            err={err}
            pathRef={pathRef}
            onOpenGoal={handleOpenGoal}
            onEditGoal={g => { setErr(''); setEditingGoal(g); setEditInput(g.title) }}
            onDeleteGoal={g => { setErr(''); setDeletingGoal(g) }}
            onOpenPhase={(ph) => { setErr(''); setSelPhase(ph); setView('phase') }}
          />
        ) : (
          <RecentTracksView
            goals={goals}
            loading={loading}
            trackBusy={trackBusy}
            busyGoalId={busyGoalId}
            err={err}
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
          busyLessonId={busyLessonId}
          err={err}
          onBack={() => setView('roadmap')}
          onLesson={handleStartLesson}
        />
      )}

      {view === 'profile' && (
        <ProfileView
          profile={profile}
          username={username}
          email={email}
          loading={loading}
          err={err}
          onUpload={handleAvatarUpload}
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

      {view === 'achievements' && (
        <AchievementsView profile={profile} goalsCount={goals.length} />
      )}

      {view === 'settings' && (
        <SettingsView
          profile={profile}
          username={username}
          email={email}
          onProfile={() => setView('profile')}
          onAchievements={() => setView('achievements')}
          onHistory={() => navigate('/history')}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
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

function HomeView({ username, profile, goals, attempts, daily, input, setInput, err, loading, trackBusy, onSend, onPractice, onReview }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        {/* ── meta de hoje + atalhos de treino/revisão ── */}
        <TodayCard
          daily={daily}
          profile={profile}
          onPractice={onPractice}
          onReview={onReview}
          busy={loading}
        />

        {/* ── composer ── */}
        <section className="mp-hero">
          <div className="mp-hero__head">
            <div className="mp-hero__badge"><IconSpark size={24} /></div>
            <div style={{ minWidth: 0 }}>
              <h1 className="mp-display">O que você quer aprender hoje?</h1>
              <p className="mp-muted" style={{ marginTop: 4 }}>
                {username ? `Bom te ver, ${username}. ` : ''}Descreva um objetivo e a trilha é montada na hora.
              </p>
            </div>
          </div>

          <textarea
            className="mp-input"
            value={input}
            onChange={e => { setInput(e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend() } }}
            placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
            rows={3}
          />

          {err && <Alert>{err}</Alert>}

          <div className="mp-cta">
            <button type="button" onClick={onSend} disabled={!input.trim() || loading} className="mp-btn">
              {loading ? <><Spinner /> Montando a trilha…</> : <>Gerar trilha <IconArrowRight /></>}
            </button>
          </div>

          {trackBusy && (
            <Busy
              style={{ marginTop: 14 }}
              title="Montando as etapas da sua trilha…"
              hint="A IA está criando os módulos e as dependências. Pode levar até 2 minutos."
            />
          )}
        </section>

        {/* ── números ── */}
        <section className="mp-stats">
          <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
          <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
          <StatCard tone="green" ico={<IconTarget />} v={goals.length} l="Objetivos" />
          <StatCard tone="violet" ico={<Ring value={xpPct(xp)} />} v={`${xpPct(xp)}%`} l={`Faltam ${Math.max(0, XP_STEP - xpInLevel(xp))} XP`} />
        </section>

        {/* ── histórico ── */}
        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}>
            <IconHistory /> Histórico
            <HistoryLink />
          </div>

          {attempts.length === 0 ? (
            <div className="mp-empty">
              <IconHistory size={26} />
              Nenhuma atividade ainda. Faça a primeira atividade de uma trilha para ela aparecer aqui.
            </div>
          ) : (
            <div className="mp-attempts">
              {attempts.map(a => <AttemptRow key={a.id} attempt={a} />)}
            </div>
          )}
        </section>
      </div>
    </div>
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
function RecentTracksCard({ goals, currentId, loading, busyGoalId, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  if (list.length <= 1) return null

  return (
    <div className="mp-card mp-card--pad">
      <div className="mp-h" style={{ marginBottom: 10 }}><IconHistory /> Trilhas recentes</div>
      <div className="mp-list">
        {list.map(g => {
          const active = g.id === currentId
          const busy = busyGoalId === g.id
          return (
            <div key={g.id} className={`mp-listrow mp-listrow--track ${active ? 'is-now' : ''}`}>
              <button
                type="button"
                className="mp-listrow__main"
                onClick={() => { if (!active) onOpenGoal(g) }}
                disabled={active || loading}
              >
                <span className="mp-listrow__t">{g.title}</span>
                <span className="mp-listrow__s">
                  {busy ? 'Montando a trilha…' : active ? 'Trilha atual' : relativeDate(g.created_at)}
                </span>
              </button>
              <span className="mp-listrow__tools">
                {busy && <Spinner size={14} style={{ marginRight: 4 }} />}
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

function GoalCard({ goal, busy, loading, onOpen, onEdit, onDelete }) {
  const s = goal.settings && typeof goal.settings === 'object' && !Array.isArray(goal.settings) ? goal.settings : {}
  const raw = goal.progress_pct ?? s.progress_pct
  const pct = typeof raw === 'number' ? Math.max(0, Math.min(100, Math.round(raw))) : null

  return (
    <div className={`mp-goal ${loading ? 'is-loading' : ''}`}>
      <button
        type="button"
        onClick={onOpen}
        className="mp-goal__open"
        aria-label={goal.title}
        aria-busy={loading || undefined}
        disabled={busy}
      >
        <span className="mp-goal__t">{goal.title}</span>
        {goal.description && (
          <span className="mp-faint" style={{ display: 'block', marginTop: 4, lineHeight: 1.45 }}>{goal.description}</span>
        )}
      </button>

      <div className="mp-goal__foot">
        {loading ? (
          <span className="mp-goal__n" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Spinner size={14} /> Montando a trilha…
          </span>
        ) : pct !== null ? (
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
        <button type="button" className="mp-goal__tool" onClick={onEdit} aria-label="Editar objetivo" disabled={busy}><IconEdit /></button>
        <button type="button" className="mp-goal__tool mp-goal__tool--del" onClick={onDelete} aria-label="Excluir objetivo" disabled={busy}><IconTrash /></button>
      </div>
    </div>
  )
}

function RecentTracksView({ goals, loading, trackBusy, busyGoalId, err, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        <section>
          <div className="mp-h" style={{ marginBottom: 4 }}>
            <IconTarget /> Trilhas recentes
          </div>
          <p className="mp-muted" style={{ marginBottom: 16 }}>
            Retome de onde parou ou comece uma trilha nova pelo Início.
          </p>

          {err && <Alert>{err}</Alert>}

          {trackBusy && (
            <Busy
              style={{ marginBottom: 16 }}
              title="Montando as etapas da sua trilha…"
              hint="A IA está criando os módulos e as dependências. Pode levar até 2 minutos."
            />
          )}

          {list.length === 0 ? (
            <div className="mp-empty">
              <IconTarget size={26} />
              {loading ? 'Carregando suas trilhas…' : 'Nenhuma trilha ainda. Vá para o Início e descreva o que você quer aprender.'}
            </div>
          ) : (
            <div className="mp-goals">
              {list.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  busy={loading}
                  loading={busyGoalId === g.id}
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

function PathView({ curGoal, topics, deps, completed, goals, loading, trackBusy, busyGoalId, err, pathRef, onOpenGoal, onEditGoal, onDeleteGoal, onOpenPhase }) {
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
          <div className="mp-card mp-card--pad mp-progress" style={{ marginBottom: 18 }}>
            <div className="mp-progress__top">
              <span>Progresso da trilha</span>
              <b>{doneLeaves}/{totalLeaves} · {pct}%</b>
            </div>
            <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
            {err && <Alert>{err}</Alert>}
          </div>

          {trackBusy && (
            <Busy
              style={{ marginBottom: 18 }}
              title="Montando as etapas da sua trilha…"
              hint="A IA está criando os módulos e as dependências. Pode levar até 2 minutos."
            />
          )}

          {!trackBusy && N === 0 && (
            <div className="mp-empty">Nenhum tópico disponível nesta trilha.</div>
          )}

          {!trackBusy && N > 0 && (
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
            loading={loading}
            busyGoalId={busyGoalId}
            onOpenGoal={onOpenGoal}
            onEditGoal={onEditGoal}
            onDeleteGoal={onDeleteGoal}
          />
        </aside>
      </div>
    </div>
  )
}

function PhaseView({ phase, completed, selNode, loading, busyLessonId, err, onBack, onLesson }) {
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

        {busyLessonId && (
          <Busy
            style={{ marginBottom: 16 }}
            title="Preparando a atividade…"
            hint="A IA está montando os exercícios. Pode levar até 2 minutos — não feche a página."
          />
        )}

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> Lições do módulo</div>
          <div className="mp-lessons">
            {ph.children.map(n => (
              <LessonRow
                key={n.id}
                n={n}
                done={completed.includes(n.id)}
                current={selNode?.id === n.id}
                busy={!!busyLessonId}
                loading={busyLessonId === n.id}
                onClick={() => onLesson(n)}
              />
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

function ProfileView({ profile, username, email, loading, err, onUpload }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)
  const streak = profile?.streak ?? 0
  const streakDays = profile?.streak_days ?? streak
  const dailyGoal = profile?.daily_goal_xp || 50

  return (
    <div className="mp-canvas">
      <div className="mp-profile">
        <section className="mp-card mp-card--pad" style={{ textAlign: 'center' }}>
          <label className="mp-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" />
            ) : (
              <div className="mp-avatar__fall">{username[0]?.toUpperCase() || '?'}</div>
            )}
            <span className="mp-avatar__lvl">{level}</span>
            <span className="mp-avatar__edit"><IconEdit /></span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px', marginTop: 16 }}>{username}</div>
          <div className="mp-faint" style={{ marginTop: 2 }}>{email}</div>

          {err && <Alert style={{ textAlign: 'left' }}>{err}</Alert>}

          <div className="mp-xpbar">
            <div className="mp-xpbar__top">
              <span>Nível {level}</span>
              <span style={{ color: 'var(--ink-3)' }}>{xpInLevel(xp)} / {XP_STEP} XP</span>
            </div>
            <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
            <div className="mp-faint" style={{ textAlign: 'right', marginTop: 8 }}>
              {Math.max(0, XP_STEP - xpInLevel(xp))} XP para o nível {level + 1}
            </div>
          </div>

          <div className="mp-profilestats">
            <div className="mp-profilestats__item">
              <span>🔥</span>
              <b>{streak}</b>
              <small>{streak === 1 ? 'dia seguido' : 'dias seguidos'}</small>
            </div>
            <div className="mp-profilestats__item">
              <span>🎯</span>
              <b>{dailyGoal}</b>
              <small>XP por dia</small>
            </div>
            <div className="mp-profilestats__item">
              <span>📚</span>
              <b>{streakDays}</b>
              <small>dias no total</small>
            </div>
          </div>

          {loading && <div className="mp-faint" style={{ marginTop: 14 }}><Spinner /> Enviando…</div>}
        </section>

        <div className="mp-aside">
          <div className="mp-stats">
            <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
            <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
            <StatCard tone="green" ico={<IconSpark />} v={Math.max(0, XP_STEP - xpInLevel(xp))} l="XP restante" />
          </div>

          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> Como funciona</div>
            <p className="mp-muted" style={{ margin: 0 }}>
              Cada lição concluída com o mínimo de acerto rende XP. A cada {XP_STEP} XP você sobe um nível
              e desbloqueia novas conquistas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Aba social: lista de amigos e busca por e-mail/@usuário.
// Vieram do upstream (ada social) e foram mantidas aqui sobre o design
// local, que reorganizou a página em torno da trilha e da lição.
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

function AchievementsView({ profile, goalsCount }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)

  const badges = [
    { t: 'Primeiro Passo', d: 'Crie seu primeiro objetivo', done: goalsCount >= 1, tone: 'blue', n: `${Math.min(goalsCount, 1)}/1` },
    { t: 'Explorador', d: 'Crie 3 objetivos diferentes', done: goalsCount >= 3, tone: 'green', n: `${Math.min(goalsCount, 3)}/3` },
    { t: 'Especialista', d: 'Alcance o nível 2', done: level >= 2, tone: 'amber', n: `Nível ${Math.min(level, 2)}/2` },
    { t: 'Mestre', d: 'Alcance o nível 5', done: level >= 5, tone: 'violet', n: `Nível ${Math.min(level, 5)}/5` },
    { t: 'Centenário', d: 'Acumule 100 XP', done: xp >= 100, tone: 'cyan', n: `${Math.min(xp, 100)}/100` },
    { t: 'Lenda', d: 'Acumule 500 XP', done: xp >= 500, tone: 'green', n: `${Math.min(xp, 500)}/500` },
  ]
  const unlocked = badges.filter(b => b.done).length

  return (
    <div className="mp-canvas">
      <div className="mp-ach">
        <div className="mp-aside">
          <div className="mp-heroach">
            <Ring big value={pct} tone="var(--amber)" />
            <div style={{ minWidth: 0 }}>
              <div className="mp-heroach__t">Conquistas</div>
              <div className="mp-heroach__s">{unlocked}/{badges.length} desbloqueadas. Continue estudando para ganhar novas medalhas!</div>
              <span className="mp-chip">
                <img src={conquistaIcon} alt="" draggable={false} />
                {goalsCount} {goalsCount === 1 ? 'objetivo' : 'objetivos'}
              </span>
            </div>
          </div>

          <div className="mp-stats">
            <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
            <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
            <StatCard tone="green" ico={<IconTarget />} v={goalsCount} l="Objetivos" />
          </div>
        </div>

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconStar /> Medalhas</div>
          <div className="mp-badges">
            {badges.map(b => (
              <div key={b.t} className={`mp-badge ${b.done ? 'is-on' : ''}`}>
                <div className="mp-badge__ico" style={{ background: `var(--${b.tone}-soft)` }}>
                  <img src={conquistaIcon} alt="" draggable={false} />
                </div>
                <div className="mp-badge__t">{b.t}</div>
                <div className="mp-badge__d">{b.d}</div>
                <div className="mp-badge__f">
                  <span className="mp-tag">{b.done ? 'Desbloqueada' : 'Bloqueada'}</span>
                  <span className="mp-badge__n">{b.n}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SettingsView({ profile, username, email, onProfile, onAchievements, onHistory, onLogout, theme, onToggleTheme }) {
  return (
    <div className="mp-canvas">
      <div className="mp-settings">
        <section className="mp-settinggroup">
          <div className="mp-h">Conta</div>
          <button type="button" onClick={onProfile} className="mp-row">
            {profile?.avatar_url ? (
              <span className="mp-row__ico" style={{ background: 'var(--surface-2)', overflow: 'hidden' }}>
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 11 }} />
              </span>
            ) : (
              <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontWeight: 800, fontSize: 16 }}>
                {username[0]?.toUpperCase() || '?'}
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
            <span className="mp-row__ico" style={{ background: 'var(--amber-soft)' }}>
              <img src={conquistaIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b"><span className="mp-row__t">Minhas conquistas</span></span>
            <IconChevron />
          </button>
          <button type="button" onClick={onHistory} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><IconHistory /></span>
            <span className="mp-row__b"><span className="mp-row__t">Histórico de estudo</span></span>
            <IconChevron />
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Aparência</div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="mp-row"
            role="switch"
            aria-checked={theme === 'dark'}
          >
            <span className="mp-row__ico" style={{ background: 'var(--violet-soft)', color: 'var(--violet-d)' }}>
              {theme === 'dark' ? <IconMoon /> : <IconSun />}
            </span>
            <span className="mp-row__b">
              <span className="mp-row__t">Tema escuro</span>
              <span className="mp-row__s">{theme === 'dark' ? 'Ligado' : 'Desligado'}</span>
            </span>
            <span className={`mp-switch ${theme === 'dark' ? 'is-on' : ''}`} aria-hidden>
              <span className="mp-switch__dot" />
            </span>
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Perfil</div>
          <button type="button" onClick={onProfile} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)' }}>
              <img src={perfilIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b"><span className="mp-row__t">Meu perfil</span></span>
            <IconChevron />
          </button>
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

function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mp-iconbtn"
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  )
}

function LessonRow({ n, done, current, busy, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={n.blocked || busy}
      aria-busy={loading || undefined}
      className={`mp-lesson ${done ? 'is-done' : n.blocked ? 'is-lock' : current ? 'is-now' : ''} ${loading ? 'is-loading' : ''}`}
    >
      <span className="mp-lesson__ico">
        {done ? <IconCheck /> : n.blocked ? <IconLock /> : current ? <IconSpark /> : <IconBolt />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="mp-lesson__t" style={{ display: 'block' }}>{n.title}</span>
        {loading ? (
          <span className="mp-lesson__s" style={{ display: 'block', color: 'var(--blue-d)' }}>
            Preparando a atividade…
          </span>
        ) : (
          n.description && <span className="mp-lesson__s" style={{ display: 'block' }}>{n.description}</span>
        )}
      </span>
      {loading ? <Spinner size={16} /> : <IconChevron />}
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

function Alert({ children, style }) {
  return <div className="mp-alert" style={style}><IconAlert /> {children}</div>
}

// ─── SHELL + NAVEGAÇÃO ────────────────────────────────────────────

const NAV = [
  { key: 'home', label: 'Início', Icon: IconHome, src: null },
  { key: 'roadmap', label: 'Trilha', Icon: IconPath, src: null },
  { key: 'social', label: 'Social', Icon: IconUsers, src: null },
  { key: 'achievements', label: 'Conquistas', Icon: null, src: conquistaIcon },
  { key: 'profile', label: 'Perfil', Icon: null, src: perfilIcon },
  { key: 'settings', label: 'Config', Icon: null, src: configIcon },
]

const TITLES = {
  home: ['Início', 'Escolha o que aprender agora'],
  roadmap: ['Trilha', 'Siga o caminho até o objetivo'],
  phase: ['Etapa', 'Lições deste módulo'],
  task: ['Tarefa', 'Responda para avançar'],
  result: ['Resultado', 'Veja como você foi'],
  profile: ['Perfil', 'Seus dados e progresso'],
  achievements: ['Conquistas', 'Suas medalhas'],
  settings: ['Configurações', 'Conta e estudo'],
}

function AppShell({ active, onNavigate, onBack, profile, username, email, onLogout, theme, onToggleTheme, children }) {
  const [title, sub] = TITLES[active] || TITLES.home

  return (
    <div className="mp">
      <div className="mp-stage">
        <header className="mp-top">
          {onBack && (
            <button type="button" onClick={onBack} className="mp-iconbtn" aria-label="Voltar">
              <IconArrowLeft />
            </button>
          )}
          <div className="mp-mark"><BrandGlyph /></div>
          <div className="mp-top__brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <span className="mp-top__title">{title}</span>
            <span className="mp-top__sub">{sub}</span>
          </div>
          <div className="mp-top__actions">
            <XpPill profile={profile} />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button type="button" onClick={onLogout} className="mp-iconbtn mp-iconbtn--danger" aria-label="Sair">
              <IconLogout />
            </button>
          </div>
        </header>

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
        <div className="mp-rail__nav">
          {NAV.map(it => <NavButton key={it.key} item={it} active={active === it.key} onNavigate={onNavigate} />)}
        </div>
        <div className="mp-rail__foot">
          <div className="mp-user">
            <span className="mp-user__a">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{username[0]?.toUpperCase() || '?'}</span>}
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

function NavButton({ item, active, onNavigate }) {
  return (
    <button
      type="button"
      className={`mp-nav ${active ? 'is-on' : ''}`}
      onClick={() => onNavigate(item.key)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mp-nav__ico">
        {item.src ? <img src={item.src} alt="" draggable={false} /> : <item.Icon />}
      </span>
      <span className="mp-nav__label">{item.label}</span>
    </button>
  )
}

function XpPill({ profile }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)
  return (
    <div className="mp-xp" title={`Nível ${level} · ${xp} XP`}>
      <div className="mp-xp__meta">
        <div className="mp-xp__lvl">Nível {level}</div>
        <div className="mp-xp__val">{xp} XP</div>
      </div>
      <Ring value={pct} />
    </div>
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

function IconPlus({ size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5.2v13.6M5.2 12h13.6" /></svg>
}

function IconLogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
}

function IconHistory() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v5h5" /><path d="M12 7.5V12l3 2" /></svg>
}

function IconSun() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.8 5.8 4.2 4.2M19.8 19.8l-1.6-1.6M18.2 5.8l1.6-1.6M4.2 19.8l1.6-1.6" /></svg>
}

function IconMoon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" /></svg>
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
