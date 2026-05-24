package topic

import (
	"os"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/topic/dto"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseValidRoadmap_Suceeds(t *testing.T) {
	roadmapStr := loadTestJSON(t, "valid_roadmap")
	r, err := parseRoadmapJSON(roadmapStr)

	require.NoError(t, err)
	require.NotNil(t, r)

	assert.Equal(t, 19, len(r.Nodes))
	assert.Equal(t, 15, len(r.Edges))

	titles := []string{
		"Lógica de Programação",
		"Internet",
		"Fundamentos de Backend",
		"Algoritmos",
		"Variáveis e Tipos",
		"Estruturas de Controle",
		"Funções",
		"Cliente e Servidor",
		"DNS",
		"HTTP",
		"APIs REST",
		"Banco de Dados",
		"Rotas",
		"Middlewares",
		"Autenticação",
		"SQL",
		"ORM",
		"Docker",
		"Deploy",
	}

	for i, node := range r.Nodes {
		err := validateTopicNode(t, node)
		assert.NoError(t, err)

		assert.Equal(t, titles[i], node.Title)
	}

	assert.Equal(t, r.Edges[0].From, "logic_prog")
	assert.Equal(t, r.Edges[0].To, "internet")
	assert.Equal(t, r.Edges[1].From, "algorithms")
	assert.Equal(t, r.Edges[1].To, "variables")

	assert.Nil(t, r.Nodes[0].ParentID)
	assert.Nil(t, r.Nodes[0].ParentID)
}

func TestParseInvalidRoadmap(t *testing.T) {
	roadmapStr := loadTestJSON(t, "invalid_roadmap")
	r, err := parseRoadmapJSON(roadmapStr)

	require.Error(t, err)
	require.Nil(t, r)

	appErr, ok := apperrors.As(err)

	require.True(t, ok)

assert.Equal(t, apperrors.ErrInvalidAIResponse, appErr.Code())
}

func validateTopicNode(_ *testing.T, n dto.TopicNode) error {
	// if n.ID == "" {
	// 	return errors.New("id cannot be empty")
	// }

	if n.Title == "" {
		return apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "title cannot be empty", nil)
	}

	if n.RequiredMastery < 0 || n.RequiredMastery > 1 {
		return apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "require_mastery must be between 0 and 1", nil)
	}

	if n.Description == "" {
		return apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "description cannot be empty", nil)
	}

	if n.Weight < 0 || n.Weight > 1 {
		return apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "weight must be between 0 and 1", nil)
	}

	return nil
}

func loadTestJSON(t *testing.T, filename string) string {
	t.Helper()

	data, err := os.ReadFile("testdata/" + filename + ".json")

	require.NoError(t, err)

	return string(data)
}
