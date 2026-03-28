package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TaskType string

const (
	TaskQuiz     TaskType = "quiz"
	TaskQuestion TaskType = "question"
	TaskEasy     TaskType = "essay"
)

type Task struct {
	ID        uuid.UUID   `json:"id"`
	UserID    uuid.UUID   `json:"user_id"`
	GoalID    uuid.UUID   `json:"goal_id"`
	Content   TaskContent `json:"content"`
	Type      TaskType    `json:"task_type"`
	Done      bool        `json:"done"`
	DoneAt    *time.Time  `json:"done_at"`
	CreatedAt time.Time   `json:"created_at"`
}

type TaskReturn struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	GoalID    uuid.UUID       `json:"goal_id"`
	Content   json.RawMessage `json:"content"`
	Type      TaskType        `json:"task_type"`
	Done      bool            `json:"done"`
	DoneAt    *time.Time      `json:"done_at"`
	CreatedAt time.Time       `json:"created_at"`
}

type TaskContent struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Questions   json.RawMessage `json:"questions"`
}

func FakeTaxi(userID, goalID uuid.UUID) []Task {
	now := time.Now()

	quizTask := Task{
		ID:     uuid.New(),
		UserID: userID,
		GoalID: goalID,
		Type:   TaskQuiz,
		Content: TaskContent{
			Title:       "Quiz completo de Go",
			Description: "Responda todas as perguntas abaixo",
			Questions: json.RawMessage(`[
			{
				"id": 1,
				"question": "O que é um slice em Go?",
				"options": [
					"Array de tamanho fixo",
					"Estrutura dinâmica baseada em array",
					"Um tipo de ponteiro"
				],
				"answer": 1
			},
			{
				"id": 2,
				"question": "Qual pacote é usado para trabalhar com JSON?",
				"options": [
					"fmt",
					"encoding/json",
					"io"
				],
				"answer": 1
			},
			{
				"id": 3,
				"question": "O que a função make() faz?",
				"options": [
					"Aloca e inicializa slices, maps e channels",
					"Cria structs",
					"Faz casting de tipos"
				],
				"answer": 0
			}
		]`),
		},
		Done:      false,
		CreatedAt: time.Now(),
	}

	paragraphTask := Task{
		ID:     uuid.New(),
		UserID: userID,
		GoalID: goalID,
		Type:   TaskEasy,
		Content: TaskContent{
			Title:       "Leitura sobre JSONB",
			Description: "Leia o texto abaixo e entenda o conceito",
			Questions: json.RawMessage(`[
				{
					"text": "JSONB no PostgreSQL é um formato binário otimizado para armazenar JSON, permitindo indexação e consultas eficientes."
				}
			]`),
		},
		Done:      false,
		CreatedAt: now,
	}

	singleQuestionTask := Task{
		ID:     uuid.New(),
		UserID: userID,
		GoalID: goalID,
		Type:   TaskQuestion,
		Content: TaskContent{
			Title:       "Pergunta direta",
			Description: "Responda com suas próprias palavras",
			Questions: json.RawMessage(`[
				{
					"question": "O que é JSONB no PostgreSQL?"
				}
			]`),
		},
		Done:      false,
		CreatedAt: now,
	}

	return []Task{quizTask, paragraphTask, singleQuestionTask}
}
