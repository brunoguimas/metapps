package task

import (
	"encoding/json"
	"strings"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validStep() Step {
	return Step{
		Index:        0,
		Kind:         StepMultipleChoice,
		Statement:    "Qual a funcao de um map em JavaScript?",
		Skill:        "map e transformacao de array",
		Difficulty:   1,
		Alternatives: []string{"Transforma e filtra", "Cria um array novo", "Ordena o array", "Remove duplicados"},
		Answer:       1,
		Explanation:  "O map cria um novo array aplicando a funcao a cada elemento.",
	}
}

func validLesson() *LessonContent {
	return &LessonContent{
		Version: 2,
		Steps: []Step{
			validStep(),
			func() Step { s := validStep(); s.Statement = "O que faz o filter?"; return s }(),
			func() Step { s := validStep(); s.Statement = "Quando usar reduce?"; return s }(),
		},
	}
}

func TestLessonContentValidate_AcceptsValidLesson(t *testing.T) {
	lesson := validLesson()
	require.NoError(t, lesson.Validate())
}

func TestLessonContentValidate_RejectsFewerThanThreeSteps(t *testing.T) {
	lesson := &LessonContent{Version: 2, Steps: []Step{validStep()}}

	err := lesson.Validate()
	require.Error(t, err)

	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrQuestionTooShort, appErr.Code())
}

func TestLessonContentValidate_RejectsMoreThanFiveSteps(t *testing.T) {
	lesson := validLesson()
	for len(lesson.Steps) < 6 {
		lesson.Steps = append(lesson.Steps, validStep())
	}

	err := lesson.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at most 5")
}

func TestStepValidate_RejectsLongStatement(t *testing.T) {
	step := validStep()
	step.Statement = strings.Repeat("a", MaxStatementLen+1)

	err := step.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "statement too long")
}

func TestStepValidate_RejectsTooFewAlternatives(t *testing.T) {
	step := validStep()
	step.Alternatives = []string{"a", "b"}

	err := step.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "between 3 and 4 alternatives")
}

func TestStepValidate_RejectsDuplicateAlternatives(t *testing.T) {
	step := validStep()
	step.Alternatives = []string{"mesma", "mesma", "outra"}

	err := step.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicated")
}

func TestStepValidate_RejectsInvalidAnswerIndex(t *testing.T) {
	step := validStep()
	step.Answer = 9

	err := step.Validate()
	require.Error(t, err)

	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidAnswerIndex, appErr.Code())
}

func TestStepValidate_RejectsLongExplanation(t *testing.T) {
	step := validStep()
	step.Explanation = strings.Repeat("b", MaxExplanationLen+1)

	err := step.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "explanation too long")
}

func TestDecodeLessonContent_NormalizesLegacyQuestions(t *testing.T) {
	legacy := json.RawMessage(`{"questions":[
      {"statement":"Pergunta antiga um","alternatives":["a","b","c"],"answer":0,"explanation":"explicacao"},
      {"statement":"Pergunta antiga dois","alternatives":["a","b","c"],"answer":1,"explanation":"explicacao"},
      {"statement":"Pergunta antiga tres","alternatives":["a","b","c"],"answer":2,"explanation":"explicacao"}
    ]}`)

	lesson, err := decodeLessonContent(legacy)
	require.NoError(t, err)
	require.Len(t, lesson.Steps, 3)
	assert.Equal(t, 0, lesson.Steps[0].Index)
	assert.Equal(t, "Pergunta antiga um", lesson.Steps[0].Statement)
	assert.Equal(t, 1, lesson.Steps[1].Answer)
}

func TestDecodeLessonContent_ReadsV2(t *testing.T) {
	v2 := json.RawMessage(`{"version":2,"steps":[
      {"statement":"A","alternatives":["a","b","c"],"answer":0,"explanation":"x"},
      {"statement":"B","alternatives":["a","b","c"],"answer":0,"explanation":"x"},
      {"statement":"C","alternatives":["a","b","c"],"answer":0,"explanation":"x"}
    ]}`)

	lesson, err := decodeLessonContent(v2)
	require.NoError(t, err)
	require.Len(t, lesson.Steps, 3)
	assert.Equal(t, 2, lesson.Version)
}

func TestStepQuestionHash_IsStableAndDistinct(t *testing.T) {
	a := validStep()
	b := validStep()
	assert.Equal(t, a.QuestionHash(), b.QuestionHash())

	b.Statement = "Outra pergunta completamente diferente?"
	assert.NotEqual(t, a.QuestionHash(), b.QuestionHash())
}

func TestLessonContentNormalize_FillsIndexes(t *testing.T) {
	lesson := &LessonContent{Steps: []Step{{Statement: " a "}, {Statement: " b "}}}
	lesson.Normalize()

	assert.Equal(t, 0, lesson.Steps[0].Index)
	assert.Equal(t, 1, lesson.Steps[1].Index)
	assert.Equal(t, "a", lesson.Steps[0].Statement)
	assert.Equal(t, StepMultipleChoice, lesson.Steps[0].Kind)
}
