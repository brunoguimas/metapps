// Package gamification concentra as regras de recompensa do MetApps.
//
// Ficam em um unico lugar de proposito: o XP precisa ser sempre calculado
// no servidor (o cliente nao pode inflar o proprio XP) e as regras nao
// podem divergir entre a rota de sessao (resposta por passo) e a rota
// legada (envio em lote).
package gamification

import "math"

const (
	// XP por exercicio acertado (base, sem bonus de combo).
	XPCorrectStep = 10

	// XP por exercicio errado. Erro nao bloqueia o estudo, mas custa.
	XPWrongStep = -5

	// Bonus quando a sessao termina com todos os exercicios corretos.
	XPPerfectBonus = 5

	// Bonus de combo: cada acerto seguido soma 2 XP, ate o teto.
	XPComboStep = 2
	XPComboCap  = 10

	// XP por dominates de um topico: proporcional ao peso do topico.
	XPMasteryWeight = 10

	// Teto do XP diario (usado como meta padrao).
	DefaultDailyGoalXP = 50
)

// StepXP devolve o XP de um exercicio acertado considerando o combo.
//
// combo e a quantidade de acertos seguidos incluindo o exercicio atual:
// 1 => 12 XP, 2 => 14, 3 => 16, e assim por diante ate o teto de 20.
func StepXP(combo int) int {
	if combo < 1 {
		combo = 1
	}

	bonus := combo * XPComboStep
	if bonus > XPComboCap {
		bonus = XPComboCap
	}

	return XPCorrectStep + bonus
}

// MasteryXP devolve o XP bonus por dominar um topico.
func MasteryXP(topicWeight float64) int {
	return int(math.Round(topicWeight * XPMasteryWeight))
}

// ApplyChange soma um delta de XP sem deixar o total negativo.
func ApplyChange(current, delta int) int {
	next := current + delta
	if next < 0 {
		return 0
	}
	return next
}
