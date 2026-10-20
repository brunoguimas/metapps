import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TodayCard from '../TodayCard.jsx'

describe('TodayCard', () => {
  it('mostra o XP de hoje contra a meta', () => {
    render(
      <TodayCard
        daily={{ xp: 30, goal_xp: 50, streak: 4, streak_active_today: true, review_due: 2 }}
        profile={{ streak: 4, daily_goal_xp: 50 }}
        onPractice={() => {}}
        onReview={() => {}}
      />
    )

    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('/ 50 XP')).toBeInTheDocument()
    expect(screen.getByText('Faltam 20 XP para bater sua meta.')).toBeInTheDocument()
  })

  it('avisa quando a meta foi batida', () => {
    render(
      <TodayCard
        daily={{ xp: 60, goal_xp: 50, streak: 4, streak_active_today: true, review_due: 0 }}
        profile={{ daily_goal_xp: 50 }}
        onPractice={() => {}}
        onReview={() => {}}
      />
    )

    expect(screen.getByText('Concluída ✓')).toBeInTheDocument()
  })

  it('mostra quantos exercicios estao esperando revisao', () => {
    render(
      <TodayCard
        daily={{ xp: 10, goal_xp: 50, streak: 1, streak_active_today: true, review_due: 3 }}
        profile={{ daily_goal_xp: 50 }}
        onPractice={() => {}}
        onReview={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /Revisão \(3\)/ })).toBeEnabled()
  })

  it('desabilita a revisao quando nao ha nada vencido', () => {
    render(
      <TodayCard
        daily={{ xp: 10, goal_xp: 50, streak: 1, streak_active_today: false, review_due: 0 }}
        profile={{ daily_goal_xp: 50 }}
        onPractice={() => {}}
        onReview={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /Revisão/ })).toBeDisabled()
  })

  it('aciona o treino', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    render(
      <TodayCard
        daily={{ xp: 0, goal_xp: 50, streak: 0, streak_active_today: false, review_due: 0 }}
        profile={{ daily_goal_xp: 50 }}
        onPractice={onPractice}
        onReview={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Treino' }))
    expect(onPractice).toHaveBeenCalled()
  })
})
