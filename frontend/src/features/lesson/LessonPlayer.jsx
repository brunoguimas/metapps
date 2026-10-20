// ─── PLAYER DE SESSÃO ────────────────────────────────────────────────
//
// O coração da experiência: UM exercício por vez, feedback instantâneo
// do servidor e um resumo no fim.
//
// O fluxo é deliberadamente simples:
//   1. o usuário escolhe uma alternativa;
//   2. "Verificar" corrige no servidor (POST /tasks/:id/answer);
//   3. o feedback aparece (certo/errado + explicação + XP);
//   4. "Continuar" leva ao próximo exercício;
//   5. no último, a sessão é encerrada (POST /tasks/:id/finish).
//
// O XP, o combo e a streak são calculados no servidor: aqui só se
// mostra o que ele devolveu.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { answerStep, createRetry, finishSession, generateCorrection } from '../../api'
import StepCard from './StepCard.jsx'
import FeedbackPanel from './FeedbackPanel.jsx'
import LessonSummary from './LessonSummary.jsx'
import { stepsOf } from './lessonUtils.js'
import { userMessage } from '../../lib/errors.js'
import './lesson.css'

export default function LessonPlayer({ task, onFinish, onExit, err }) {
  // A sessao vive em estado local: "refazer os errados" troca a sessao
  // por uma nova sem desmontar o player.
  const [session, setSession] = useState(task)

  useEffect(() => {
    setSession(task)
  }, [task])

  const steps = useMemo(() => stepsOf(session), [session])

  const [index, setIndex] = useState(() => {
    const cursor = Number(task?.step_cursor || 0)
    return cursor > 0 && cursor < steps.length ? cursor : 0
  })
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [xp, setXp] = useState(0)
  const [combo, setCombo] = useState(0)
  const [streak, setStreak] = useState(0)
  const [daily, setDaily] = useState({ xp: 0, goal: 0 })
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [summary, setSummary] = useState(null)
  const [correction, setCorrection] = useState(null)
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  const step = steps[index]
  const total = steps.length
  const isLast = index >= total - 1

  useEffect(() => {
    setStartedAt(Date.now())
  }, [index])

  const verify = useCallback(async () => {
    if (selected === null || busy || !step) return
    setBusy(true)
    setLocalErr('')
    try {
      const result = await answerStep(session.id, index, selected)
      setFeedback({
        correct: result.correct,
        correct_answer: result.correct_answer,
        explanation: result.explanation,
        hint: result.hint,
        alternatives: step?.alternatives || [],
      })
      setXp(result.xp_awarded)
      setCombo(result.combo || 0)
      if (typeof result.streak === 'number') setStreak(result.streak)
      if (typeof result.daily_xp === 'number') {
        setDaily({ xp: result.daily_xp, goal: result.daily_goal || 0 })
      }
    } catch (e) {
      setLocalErr(userMessage(e, 'Não foi possível verificar a resposta. Tente novamente.'))
    } finally {
      setBusy(false)
    }
  }, [selected, busy, step, session?.id, index])

  const advance = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setLocalErr('')
    try {
      if (!isLast) {
        setIndex(i => i + 1)
        setSelected(null)
        setFeedback(null)
        setXp(0)
        setCombo(0)
        return
      }

      // Último exercício: encerra a sessão.
      const seconds = Math.round((Date.now() - startedAt) / 1000)
      const result = await finishSession(session.id, {
        attempt_source: 'web',
        time_spent_ms: seconds * 1000,
      })
      setSummary(result)

      // O feedback da IA é o "resumo deeper" da sessão: vem depois do
      // feedback instantâneo de cada exercício.
      //
      // A geração leva alguns segundos: enquanto isso, o resumo mostra
      // que o feedback está sendo preparado (e não um bloco vazio).
      if (result?.attempt_id) {
        setCorrectionLoading(true)
        try {
          const corr = await generateCorrection(result.attempt_id)
          setCorrection(corr)
        } catch { /* ignore */ } finally {
          setCorrectionLoading(false)
        }
      }
    } catch (e) {
      setLocalErr(userMessage(e, 'Não foi possível finalizar a sessão. Tente novamente.'))
    } finally {
      setBusy(false)
    }
  }, [busy, isLast, startedAt, session?.id])

  // Atalhos de teclado: 1-4 escolhem, Enter verifica/continua.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const options = step?.alternatives || []

      if (!feedback) {
        const n = parseInt(e.key, 10)
        if (!Number.isNaN(n) && n >= 1 && n <= options.length) {
          e.preventDefault()
          setSelected(n - 1)
          return
        }
        if (e.key === 'Enter' && selected !== null) {
          e.preventDefault()
          verify()
        }
        return
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, selected, step, verify, advance])

  // Refazer só os exercícios errados: o backend monta uma nova sessão
  // com os passos que não foram acertados.
  const retryWrong = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setLocalErr('')
    try {
      const next = await createRetry(session.id)
      setSession(next)
      setIndex(0)
      setSelected(null)
      setFeedback(null)
      setXp(0)
      setCombo(0)
      setSummary(null)
      setCorrection(null)
      setCorrectionLoading(false)
      setStartedAt(Date.now())
    } catch (e) {
      setLocalErr(userMessage(e, 'Não foi possível montar a nova tentativa. Tente novamente.'))
    } finally {
      setBusy(false)
    }
  }, [busy, session?.id])

  if (summary) {
    return (
      <LessonSummary
        result={summary}
        task={session}
        correction={correction}
        correctionLoading={correctionLoading}
        onRetry={retryWrong}
        onNext={() => onFinish(summary)}
      />
    )
  }

  if (!step) {
    return (
      <div className="lp-wrap">
        <p className="lp-empty">Esta sessão não tem exercícios.</p>
      </div>
    )
  }

  const pct = total > 0 ? ((index + (feedback ? 1 : 0)) / total) * 100 : 0

  return (
    <div className="lp-wrap">
      <header className="lp-top">
        <button type="button" className="lp-top__close" onClick={onExit} aria-label="Sair da sessão">
          ✕
        </button>

        <div className="lp-top__bar">
          <div className="lp-top__fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="lp-top__stats">
          <span className="lp-top__xp" title="XP total">{daily.xp || xp || 0} XP</span>
          {combo > 1 && <span className="lp-top__combo">×{combo}</span>}
          {streak > 0 && <span className="lp-top__streak" title="Dias seguidos de estudo">🔥 {streak}</span>}
        </div>
      </header>

      <main className="lp-main">
        <div className="lp-title">
          <h2>{session?.meta?.title || 'Sessão'}</h2>
          {session?.meta?.description && <p>{session.meta.description}</p>}
        </div>

        <StepCard
          step={step}
          index={index}
          total={total}
          selected={selected}
          onSelect={setSelected}
          feedback={feedback}
          disabled={busy}
        />

        {!feedback && (
          <button
            type="button"
            className="lp-verify"
            onClick={verify}
            disabled={selected === null || busy}
          >
            {busy ? 'Verificando…' : 'Verificar'}
          </button>
        )}

        <FeedbackPanel
          feedback={feedback}
          xp={xp}
          combo={combo}
          onContinue={advance}
          isLast={isLast}
          busy={busy}
        />

        {(localErr || err) && (
          <div className="lp-error" role="alert">{localErr || err}</div>
        )}
      </main>

      <footer className="lp-foot">
        <span>Atalho: teclas <kbd>1</kbd>–<kbd>4</kbd> para escolher, <kbd>Enter</kbd> para confirmar.</span>
      </footer>
    </div>
  )
}
