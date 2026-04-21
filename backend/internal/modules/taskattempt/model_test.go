package taskattempt

import "testing"

func TestParseCreateAttemptInput_RejectsUnknownTopLevelField(t *testing.T) {
	_, err := ParseCreateAttemptInput([]byte(`{
		"type":"essay",
		"response":"texto",
		"extra":true
	}`))
	if err == nil {
		t.Fatalf("expected error for unknown top-level field")
	}
}

func TestParseCreateAttemptInput_RejectsUnknownMetadataField(t *testing.T) {
	_, err := ParseCreateAttemptInput([]byte(`{
		"type":"essay",
		"response":"texto",
		"metadata":{"foo":"bar"}
	}`))
	if err == nil {
		t.Fatalf("expected error for unknown metadata field")
	}
}

func TestParseCreateAttemptInput_RejectsQuizMissingQuestionIndex(t *testing.T) {
	_, err := ParseCreateAttemptInput([]byte(`{
		"type":"quiz",
		"response":[{"answer":1}]
	}`))
	if err == nil {
		t.Fatalf("expected error for missing question_index")
	}
}

func TestParseCreateAttemptInput_AcceptsValidQuizPayload(t *testing.T) {
	input, err := ParseCreateAttemptInput([]byte(`{
		"type":"quiz",
		"response":[{"question_index":0,"answer":1}],
		"metadata":{"time_spent_ms":1234,"attempt_source":"web"}
	}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if input.Type != "quiz" {
		t.Fatalf("unexpected type: %s", input.Type)
	}
	if input.Metadata == nil || input.Metadata.AttemptSource != "web" {
		t.Fatalf("metadata was not parsed correctly")
	}
}
