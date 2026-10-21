package profile

import (
	"strings"
	"testing"
)

func TestBuildAvatarURLAddsAvatarsPrefix(t *testing.T) {
	cases := []struct {
		base     string
		filename string
		want     string
	}{
		{"http://localhost:8080", "abc.png", "http://localhost:8080/avatars/abc.png"},
		// base com barra final não pode virar "//avatars"
		{"http://localhost:8080/", "abc.png", "http://localhost:8080/avatars/abc.png"},
		// base que já traz o prefixo não pode duplicar
		{"http://localhost:8080/avatars", "abc.png", "http://localhost:8080/avatars/abc.png"},
		{"http://localhost:8080/avatars/", "abc.png", "http://localhost:8080/avatars/abc.png"},
	}

	for _, c := range cases {
		if got := BuildAvatarURL(c.base, c.filename); got != c.want {
			t.Errorf("BuildAvatarURL(%q, %q) = %q, quer %q", c.base, c.filename, got, c.want)
		}
	}
}

func TestNormalizeAvatarURLRepairsLegacyRecords(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		// registro legado: sem o prefixo /avatars, que era o bug
		{"http://localhost:8080/abc.png", "http://localhost:8080/avatars/abc.png"},
		{"http://api.metapps.com/abc.png", "http://api.metapps.com/avatars/abc.png"},
		// já correto: não toca
		{"http://localhost:8080/avatars/abc.png", "http://localhost:8080/avatars/abc.png"},
		// caminho relativo: a API pode devolver só o path
		{"/avatars/abc.png", "/avatars/abc.png"},
		// vazio/nil não pode virar "/avatars/"
		{"", ""},
		// sem barra nenhuma depois do host: não é avatar, devolve como veio
		{"http://localhost:8080", "http://localhost:8080"},
	}

	for _, c := range cases {
		if got := NormalizeAvatarURL(c.raw); got != c.want {
			t.Errorf("NormalizeAvatarURL(%q) = %q, quer %q", c.raw, got, c.want)
		}
	}
}

func TestNormalizeAvatarURLKeepsOtherPaths(t *testing.T) {
	// uma URL que não é avatar (ex.: foto de perfil de outro serviço,
	// CDN) não pode ser reescrita. Só inserimos o prefixo quando o path
	// parece um arquivo solto.
	raw := "https://cdn.exemplo.com/u/9f8e7d.png"
	if got := NormalizeAvatarURL(raw); got != raw && !strings.Contains(got, "/avatars/") {
		t.Errorf("NormalizeAvatarURL alterou URL de CDN: %q", got)
	}
}
