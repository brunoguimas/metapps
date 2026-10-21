package gamification

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStepXP_ComboBonus(t *testing.T) {
	assert.Equal(t, 12, StepXP(1))
	assert.Equal(t, 14, StepXP(2))
	assert.Equal(t, 16, StepXP(3))
}

func TestStepXP_CapsComboBonus(t *testing.T) {
	assert.Equal(t, XPCorrectStep+XPComboCap, StepXP(5))
	assert.Equal(t, XPCorrectStep+XPComboCap, StepXP(50))
}

func TestStepXP_TreatsNonPositiveComboAsOne(t *testing.T) {
	assert.Equal(t, 12, StepXP(0))
	assert.Equal(t, 12, StepXP(-3))
}

func TestMasteryXP_IsProportionalToWeight(t *testing.T) {
	assert.Equal(t, 10, MasteryXP(1))
	assert.Equal(t, 5, MasteryXP(0.5))
	assert.Equal(t, 25, MasteryXP(2.5))
	assert.Equal(t, 0, MasteryXP(0))
}

func TestApplyChange_NeverGoesNegative(t *testing.T) {
	assert.Equal(t, 0, ApplyChange(3, -5))
	assert.Equal(t, 10, ApplyChange(3, 7))
	assert.Equal(t, 0, ApplyChange(0, -5))
}
