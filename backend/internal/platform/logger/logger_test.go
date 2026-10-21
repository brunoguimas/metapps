package logger

import (
	"errors"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
)

func TestRootCause(t *testing.T) {
	driverErr := errors.New("pq: (ENOTFOUND) tenant/user postgres.abc not found")

	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "erro simples sem wrap",
			err:  driverErr,
			want: driverErr.Error(),
		},
		{
			name: "AppError com um nivel",
			err:  apperrors.NewAppError(apperrors.ErrInternal, "couldn't get oauth account", driverErr),
			want: driverErr.Error(),
		},
		{
			name: "AppError aninhado (caso do google callback)",
			err: apperrors.NewAppError(
				apperrors.ErrInternal,
				string(apperrors.ErrInternal),
				apperrors.NewAppError(apperrors.ErrInternal, "couldn't get oauth account", driverErr),
			),
			want: driverErr.Error(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := rootCause(tt.err); got == nil || got.Error() != tt.want {
				t.Fatalf("rootCause = %v, quer %q", got, tt.want)
			}
		})
	}
}

func TestCauseAttrsExpoeCausaRaiz(t *testing.T) {
	driverErr := errors.New("pq: (ENOTFOUND) tenant/user postgres.abc not found")
	err := apperrors.NewAppError(
		apperrors.ErrInternal,
		string(apperrors.ErrInternal),
		apperrors.NewAppError(apperrors.ErrInternal, "couldn't get oauth account", driverErr),
	)

	attrs := causeAttrs(err)
	found := map[string]string{}
	for i := 0; i+1 < len(attrs); i += 2 {
		if k, ok := attrs[i].(string); ok {
			found[k], _ = attrs[i+1].(string)
		}
	}

	if found["cause"] != driverErr.Error() {
		t.Fatalf("cause = %q, quer %q", found["cause"], driverErr.Error())
	}

	wantChain := "INTERNAL_ERROR <- couldn't get oauth account <- " + driverErr.Error()
	if found["chain"] != wantChain {
		t.Fatalf("chain = %q, quer %q", found["chain"], wantChain)
	}
}

func TestCauseAttrsVazioSemWrap(t *testing.T) {
	if attrs := causeAttrs(errors.New("sem wrap")); attrs != nil {
		t.Fatalf("esperava nil, veio %v", attrs)
	}
}
